import { APIRequestContext, Page } from 'playwright-core';
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

export default class PageImageSourceGanzo implements ISource<ICollectProductPhotosTask> {
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
    return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
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

      const link = page
        .locator(
          '#block-personal-content > div > div > div > div > div > div > div > div.product-teaser__top > div > div.product-teaser__image--wrapper > a',
        )
        .first();

      await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');
      const absoluteHref = new URL(relativeHref, page.url()).toString();

      console.log('===>>  absoluteHref = ', absoluteHref);
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator(
        '#block-personal-content > div > div > div > div.product-full__top > div.product-full__top--left.product-full__top-item > div.product-full__gallery.swiper-arrow-style-2.swiper-arrow-style-min > div > div.product-gl__images',
      );
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
        .locator('img')
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')).filter(Boolean));

      const absoluteImageUrls = imageUrls.map((src) => new URL(src!, page.url()).toString());

      if (absoluteImageUrls.length === 0) throw new Error('No valid image URLs found');

      // поиск описания
      const htmlCont = page.locator('div.field-product-desc__item.field__item');
      await htmlCont
        .first()
        .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      // удаляю видео ролики
      html = await htmlCont.evaluate((el) => {
        el.querySelectorAll('div').forEach((div) => div.remove());
        return el.innerHTML;
      });

      images[sku] = absoluteImageUrls as IDataImagItem;
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
