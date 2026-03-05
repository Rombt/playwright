import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';
import { IHttpResult } from '../../data/entities/IResults/IHttpResult';
import { ILogger } from '../../data/logger/types/ILogger';
import { Logger } from '../../data/logger/Logger';
import { AppConfig } from '../../data/config/appConfig';

export default class PageImageSourceJoma implements ISource<ICollectProductPhotosTask> {
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
    return task.metadata.target_website === 'https://joma.ua/search/?q={{sku_prod}}';
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

    results.push(await this.execute(targetUrl, page, { product, loggerScope }));

    return results;
  }

  async execute(
    targetUrl: string,
    page: Page,
    options: { product: IProduct; loggerScope?: ILogger },
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const data: IDataImag = {};

    const rawSku = options.product.sku;
    const starIndex = rawSku.indexOf('*');
    const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const link = page
        .locator(
          'body > div > main > div.categories > div.category > div.category-content > div > a',
        )
        .first();

      await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');
      const absoluteHref = new URL(relativeHref, page.url()).toString();

      console.log('===>>  absoluteHref = ', absoluteHref);
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator('#splide01-list');
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
        .evaluateAll((imgs) =>
          imgs
            .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
            .map((img) => img.src),
        );

      if (imageUrls.length === 0) {
        options.loggerScope?.error(`No valid image URLs found`, {
          component: 'PageImageSourceNike',
          method: 'execute()',
          action: 'gallery.waitFor(...)',
          data: {
            imageUrlsLength: imageUrls.length,
            imageUrls: imageUrls,
          },
        });

        throw new Error('Error. No valid image URLs found');
      }

      data[sku] = imageUrls;
    } catch (err) {
      throw this.buildWorkerError(err, options.product, url);
    }

    options.loggerScope?.debug(`Collecting image URLs is complete`, {
      component: 'PageImageSourceNike',
      method: 'execute()',
      action: 'data[sku] = imageUrls',
      data: {
        urls: data,
      },
    });

    return { data, errors };
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
