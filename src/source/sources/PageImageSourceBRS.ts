import { APIRequestContext, Page } from 'playwright-core';
import { fuzzy } from 'fast-fuzzy';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';
import { IHttpResult } from '../../data/entities/IResults/IHttpResult';
import { ILogger } from '../../data/logger/types/ILogger';
import { Logger } from '../../data/logger/Logger';
import { AppConfig } from '../../data/config/appConfig';

export default class PageImageSourceBRS implements ISource<ICollectProductPhotosTask> {
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor() {
    this.config = AppConfig.getInstance();
    this.logger = Logger.getInstance();
  }

  workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    sku: string,
  ): Promise<IHttpResult<unknown>> {
    throw new Error('Method not implemented.');
  }

  executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: { url: string; params?: Record<string, string>; headers?: Record<string, string> },
  ): Promise<IHttpResult<T>> {
    throw new Error('Method not implemented.');
  }

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://borsuk.com.ua/katalog/search/?q={{sku_prod}}';
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
    loggerScope?: ILogger,
    sku?: string,
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult[]> {
    const results = [];

    let product: IProduct | undefined;

    if (typeof getNext === 'function') {
      product = getNext();
    } else if (getNext) {
      product = getNext;
    }

    if (!product) {
      throw new Error('Product is undefined');
    }

    loggerScope?.debug('Worker initialized with valid product', {
      component: 'DPageImageSourceColumbia',
      method: 'worker(...)',
      data: {
        targetUrl: targetUrl,
        page: page,
        product: product,
        limiter: limiter,
        sku: sku,
        debugMeta: debugMeta,
      },
    });

    results.push(await this.execute(targetUrl, page, product));

    return results;
  }

  async execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const images: IDataImag = {};
    let html: string = '';

    const rawSku = product.sku;
    const starIndex = rawSku.indexOf('*');
    const sku =
      (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
        /^[\p{C}\s]+|[\p{C}\s]+$/gu,
        '',
      ) ?? '';

    this.logger?.debug(`*** Normalize SKU ****`, {
      component: 'PageImageSourceBRS',
      method: 'execute()',
      action: '(starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)',
      data: {
        originalSKU: product.sku,
        sku: sku,
      },
    });

    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const link = page.locator('div.catalogCard-view > a').first();

      const empty = page.locator('.catalog__content > div > p', {
        hasText: 'Немає товарів',
      });

      try {
        await Promise.race([
          link.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
          empty.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
        ]);
      } catch {
        throw new Error(`Search result not resolved. ${sku}`);
      }

      if ((await empty.count()) > 0) {
        throw new Error(`Goods not found on the page. ${sku}`);
      }

      await link.waitFor({ state: 'visible' });

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');

      const absoluteHref = new URL(relativeHref, page.url()).toString();
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      // #main > div.wrapper > section > div.product__grid > div.product__column.product__column--left.product__column--sticky > div > div:nth-child(1) > div > div > div > div > section > div.gallery__photos
      const gallery = page.locator('div.gallery__photos');

      try {
        await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const imageUrls = await gallery
        .locator('.gallery__item > span.gallery__link')
        .evaluateAll((links) =>
          links
            .map((link) => link.getAttribute('data-href'))
            .filter(Boolean)
            .map((url) => new URL(url!, document.baseURI).href),
        );

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');

      // поиск описания
      //
      const htmlCont = page.locator('div.product-description[itemprop="description"]');
      // const htmlCont = page.locator('div[itemprop="description"]');
      await htmlCont
        .first()
        .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
      html = await htmlCont.innerHTML({ timeout: this.config.asyncRetry.maxDelay });

      // console.log('htmlCont.count() = ', await htmlCont.count());

      images[sku] = imageUrls as IDataImagItem;
      images[sku].idProduct = product.id_product;
    } catch (err) {
      throw this.buildWorkerError(err, product, url);
    }

    return {
      data: {
        images,
        html,
      },
      errors,
    };
  }

  private buildWorkerError(
    err: unknown,
    product: IProduct,
    targetUrl: string,
    retryable: boolean = true,
  ): IWorkerError {
    return {
      error: err,
      product,
      targetUrl,
    };
  }
}
