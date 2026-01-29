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
      console.log('targetUrl = ', targetUrl);
      console.log('product = ', product);
      //* Здесь все операции со страницей
      // const url = buildProductUrl(product.sku);
      // await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      errors.push(err as IWorkerError);
    }

    return { data, errors };
  }
}
