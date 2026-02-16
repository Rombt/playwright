import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';

export default class PageImageSourceRozetka implements ISource<ICollectProductPhotosTask> {
  supports(task: ICollectProductPhotosTask): boolean {
    return task.type === 'recollect-product-photos';
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<unknown[]> {
    const results = [];

    while (true) {
      const product = getNext();
      if (!product) break;

      await limiter.wait();
      results.push(await this.execute(targetUrl, page, product));
    }

    return results;
  }

  execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult> {
    throw new Error('Method not implemented.');
  }

  async workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<unknown[]> {
    const results = [];

    while (true) {
      const product = getNext();
      if (!product) break;

      await limiter.wait();
      results.push(await this.executeHttpRequest(request, headers, targetUrl, product));
    }

    return results;
  }

  async executeHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    product: IProduct,
  ): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const data: IDataImag = {};

    const rawSku = product.sku;
    const starIndex = rawSku.indexOf('*');
    const sku =
      (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
        /^[\p{C}\s]+|[\p{C}\s]+$/gu,
        '',
      ) ?? '';

    try {
      const response = await request.get(targetUrl, {
        params: {
          country: 'UA',
          lang: 'ua',
          text: sku,
        },
        headers: headers,
      });

      if (response.status() === 429 || response.status() === 403) {
        await this.delay(10000);
        return { data, errors };
      }

      const res = await response.json();

      console.log('for sku ', sku);
      console.log('res: ');
      console.dir(res, { depth: null, colors: true });
    } catch (err) {
      errors.push({
        error: err,
        product: product,
        url: targetUrl,
      } as IWorkerError);
    }

    console.log('==>> data: ', data);

    return { data, errors };
  }

  //todo использовать const limiter = new RateLimiter(2000);
  delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}
