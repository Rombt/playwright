import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';
import { IHttpResult, IAutocompleteResponse } from '../../data/entities/IResults/IHttpResult';

export default class PageImageSourceRozetka implements ISource<ICollectProductPhotosTask> {
  supports(task: ICollectProductPhotosTask): boolean {
    return task.type === 'recollect-product-photos';
  }

  async workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<IHttpResult<IAutocompleteResponse>[]> {
    const results: IHttpResult<IAutocompleteResponse>[] = [];

    while (true) {
      const product = getNext();
      if (!product) break;

      const rawSku = product.sku;
      const starIndex = rawSku.indexOf('*');
      const sku =
        (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
          /^[\p{C}\s]+|[\p{C}\s]+$/gu,
          '',
        ) ?? '';

      const options = {
        url: targetUrl,
        params: {
          country: 'UA',
          lang: 'ua',
          text: sku,
        },
        headers: headers,
      };

      await limiter.wait();

      const requestResult = await this.executeHttpRequest<IAutocompleteResponse>(request, options);
      results.push(requestResult);
    }

    return results;
  }

  async executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<IHttpResult<T>> {
    const limiter = new RateLimiter(5000);

    try {
      const response = await request.get(options.url, {
        params: options.params,
        headers: options.headers,
      });

      const status = response.status();

      if (status === 429 || status === 403) {
        await limiter.sleep(1000, 5000);
      }

      let body: T | null = null;

      try {
        body = await response.json();
      } catch {
        // если не JSON
      }

      return {
        ok: status >= 200 && status < 300,
        status,
        body,
        headers: response.headers(),
        url: options.url,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        body: null,
        error,
        headers: {},
        url: options.url,
      };
    }
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
    sku: string,
  ): Promise<IWorkerResult[]> {
    const results = [];

    while (true) {
      if (!targetUrl) break;
      await limiter.wait();
      results.push(await this.execute(targetUrl, page, undefined, sku));
    }

    return results;
  }

  async execute(url: string, page: Page, product?: IProduct, sku?: string): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const data: IDataImag = {};

    try {
      console.log('===>>>   Пробую url = ', url);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator('.container');

      try {
        await gallery.first().waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error(`No gallery found on page: ${error}`);
      }

      const imageUrls: string[] = await gallery
        .locator('img')
        .evaluateAll(imgs =>
          imgs
            .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
            .map(img => img.src),
        );

      console.log('======>>>   imageUrls = ', imageUrls);

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');
      if (!sku) throw new Error('SKU is required');

      data[sku] = imageUrls;
    } catch (err) {
      console.log('======>>>   err = ', err);
      errors.push({
        error: err,
        product: product,
        url: url,
      } as IWorkerError);
    }

    return { data, errors };
  }
}
