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

export default class PageImageSourceKiborg implements ISource<ICollectProductPhotosTask> {
  private readonly config: AppConfig;

  constructor() {
    this.config = AppConfig.getInstance();
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
    return task.metadata.target_website === 'https://kiborg.com.ua/ru/#/search/{{sku_prod}}';
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
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // body > div:nth-child(41) > div > div.multi-wrapper > div > div.multi-results > div > div.multi-cell.multi-lists > div > div:nth-child(1) > div > div > a
      // .multi-grid
      const link = page.locator('.multi-grid a').first();

      const empty = page.locator('.multi-noResults', {
        hasText: 'Нічого не знайдено',
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

      const links = page.locator('.multi-grid a');
      await links.first().waitFor({ state: 'visible' });

      const quantityLinks = await links.count();
      let bestMatch = null;
      let bestScore = -Infinity;

      for (let i = 0; i < quantityLinks; i++) {
        const link = links.nth(i);
        const text = (await link.innerText()).trim();

        const score = fuzzy(product.name_product, text);

        if (score > bestScore) {
          bestScore = score;
          bestMatch = link;
        }
      }

      if (!bestMatch) {
        throw new Error('The product name not found');
      }

      const relativeHref = await bestMatch.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');

      const absoluteHref = new URL(relativeHref, page.url()).toString();
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      // #swiper-wrapper-80532ea6b8868d67 > div.sc-product-images-slide.swiper-slide.pb-3.pb-md-4.swiper-slide-active > span > img.zoomImg
      const gallery = page.locator('.sc-product-images-main .swiper');

      try {
        await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      // div.swiper-slide img.zoomImg
      const imageUrls = await gallery
        .locator('div.swiper-slide img.zoomImg')
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')).filter(Boolean));

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');

      // поиск описания
      const htmlCont = page.locator('div.sc-product-content-left');
      await htmlCont
        .first()
        .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      // удаляю видео ролики
      html = await htmlCont.evaluate((el) => {
        el.querySelectorAll('div.ex_product_tab_1, div.sc-product-content-reviews').forEach((div) =>
          div.remove(),
        );
        return el.innerHTML;
      });

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
