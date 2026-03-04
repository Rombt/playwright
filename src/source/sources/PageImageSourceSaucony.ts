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

export default class PageImageSourceSaucony implements ISource<ICollectProductPhotosTask> {
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
    return (
      task.metadata.target_website ===
      'https://saucony.kiev.ua/index.php?route=product/search&search={{sku_prod}}'
    );
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
    const data: IDataImag = {};

    const rawSku = product.sku;
    const starIndex = rawSku.indexOf('*');
    const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const link = page.locator('#dop_images > a.image_1').first();

      await link.waitFor({ state: 'attached', timeout: 30000 });

      const href = await link.getAttribute('href');
      if (!href) throw new Error('Product link not found');

      console.log('===>>  href = ', href);
      await page.goto(href, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator('#carouselExampleIndicators');
      try {
        await gallery.waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'attached', timeout: 15000 });

      const imageUrls = await gallery
        .locator('img')
        .evaluateAll((imgs) =>
          imgs
            .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
            .map((img) => img.src),
        );

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');

      data[sku] = imageUrls;
    } catch (err) {
      errors.push({
        error: err,
        product: product,
        url: url,
      } as IWorkerError);
    }

    console.log('==>> data: ', data);

    return { data, errors };
  }
}
