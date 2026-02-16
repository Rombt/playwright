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

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<IWorkerResult[]> {
    const results = [];

    while (true) {
      const product = getNext();
      if (!product) break;

      await limiter.wait();
      results.push(await this.execute(targetUrl, page, product));
    }

    return results;
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

  execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult> {
    throw new Error('Method not implemented.');
  }

  async executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<IHttpResult<T>> {
    try {
      const response = await request.get(options.url, {
        params: options.params,
        headers: options.headers,
      });

      const status = response.status();

      if (status === 429 || status === 403) {
        await this.delay(10000);
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

  //todo использовать const limiter = new RateLimiter(2000);
  delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}
