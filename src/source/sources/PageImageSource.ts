import { Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ITask } from '../../data/entities/ITask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';

import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { Product } from '../../data/entities/Product';

export default class PageImageSource implements ISource<ITask> {
  private i = 0; //! для тестов

  supports(task: ITask): boolean {
    return task.type === 'collect_product_photos';
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => Product | undefined,
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

  async execute(targetUrl: string, page: Page, product: Product): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const data: unknown[] = [];

    try {
      this.i++;
      console.log('*****  execute ***** i = ', this.i);
      // console.log('targetUrl = ', targetUrl);
      // console.log('product = ', product);
      //* Здесь все операции со страницей

      const rawSku = product.sku;
      const starIndex = rawSku.indexOf('*');
      const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;

      const url = targetUrl.replace('{{sku_prod}}', sku);

      console.log('url = ', url);

      await page.goto(url);
      // await page.goto(url, { waitUntil: 'domcontentloaded' });
      // await page.close();
    } catch (err) {
      errors.push(err as IWorkerError);
    }

    return { data, errors };
  }

  // buildProductUrl(targetUrl: string, sku: string) {

  //   sku = sku.slice(0, sku.indexOf('*'));

  //   return targetUrl.replace('{{sku_prod}}', sku);
  // }
}
