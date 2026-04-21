import { Page, APIRequestContext } from 'playwright';

import { BasePageSource } from '../BasePageSource';

import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IHttpResult } from '../../data/entities/IResults/IHttpResult';
import { IProduct } from '../../data/entities/IProduct';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { ILogger } from '../../data/logger/types/ILogger';
import { RateLimiter } from '../../browser/limiter/RateLimiter';

import { DirectPageResolver } from '../strategies/resolvers/DirectPageResolver';
import { SimpleDescriptionExtractor } from '../strategies/extractors/SimpleDescriptionExtractor';

export class BRSSource extends BasePageSource<ICollectProductPhotosTask> {
  protected resolver = new DirectPageResolver();

  protected imageExtractor = undefined; // пока без ImageExtractor

  protected descriptionExtractor = new SimpleDescriptionExtractor(
    'div.product__section > [itemprop="description"]',
  );

  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://borsuk.com.ua/katalog/search/?q={{sku_prod}}';
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: (() => IProduct | undefined) | IProduct,
    loggerScope?: ILogger,
    sku?: string,
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult[]> {
    const product = typeof getNext === 'function' ? getNext() : getNext;

    if (!product) {
      throw new Error('Product is undefined');
    }

    const result = await this.execute(targetUrl, page, {}, debugMeta, product.sku);

    return [result];
  }

  async execute(
    targetUrl: string,
    page: Page,
    options: {},
    debugMeta?: Record<string, string>,
    sku?: string,
  ): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];

    try {
      if (!sku) {
        throw new Error('SKU is required');
      }

      const normalizedSku = this.normalizeSku(sku);
      const url = targetUrl.replace('{{sku_prod}}', normalizedSku);

      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const link = page.locator('div.catalogCard-view > a').first();

      const empty = page.locator('.catalog__content > div > p', { hasText: 'Немає товарів' });

      await Promise.race([
        link.waitFor({ state: 'visible', timeout: 15000 }),
        empty.waitFor({ state: 'visible', timeout: 15000 }),
      ]);

      if ((await empty.count()) > 0) {
        throw new Error(`Goods not found: ${sku}`);
      }

      const href = await link.getAttribute('href');
      if (!href) throw new Error('Product link not found');

      const absolute = new URL(href, page.url()).toString();
      await page.goto(absolute, { waitUntil: 'domcontentloaded' });

      // check sku
      const skuLocator = page.locator('div.product-header div.product-header__code', {
        hasText: sku,
      });

      await skuLocator.first().waitFor({
        state: 'attached',
        timeout: 15000,
      });

      // extraction via strategies
      const extraction = await this.extract(page);

      return this.buildResult(extraction, errors, normalizedSku);
    } catch (err) {
      throw this.buildError(err, targetUrl, sku);
    }
  }

  private normalizeSku(rawSku: string): string {
    const starIndex = rawSku.indexOf('*');

    return (starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku)
      .replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '')
      .trim();
  }

  private buildError(err: unknown, targetUrl: string, sku?: string): IWorkerError {
    return {
      error: err,
      targetUrl,
      sku,
    } as any;
  }

  // HTTP (legacy untouched)
  executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<IHttpResult<T>> {
    throw new Error('Not implemented');
  }

  workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    sku: string,
  ): Promise<IHttpResult<unknown>> {
    throw new Error('Not implemented');
  }
}
