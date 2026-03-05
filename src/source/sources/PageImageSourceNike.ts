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

export default class PageImageSourceNike implements ISource<ICollectProductPhotosTask> {
  private readonly config: AppConfig;
  // private readonly logger: Logger;
  constructor() {
    this.config = AppConfig.getInstance();
    // this.logger = Logger.getInstance();
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
    return task.metadata.target_website === 'https://www.nike.com/fi/w?q={{sku_prod}}';
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
          '#skip-to-products > div:nth-child(1) > div > figure > a.product-card__img-link-overlay',
        )
        .first();

      await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const href = await link.getAttribute('href');
      if (!href) {
        options.loggerScope?.error(`Product link not found`, {
          component: 'PageImageSourceNike',
          method: 'execute()',
          action: "href = await link.getAttribute('href')",
          data: {
            href: href,
          },
        });

        throw new Error('Error. Product link not found');
      }

      options.loggerScope?.debug(`Collecting image URLs is started`, {
        component: 'PageImageSourceNike',
        method: 'execute()',
        action: "href = await link.getAttribute('href')",
        data: {
          href: href,
        },
      });

      await page.goto(href, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator(
        '#__next > main > div.nds-grid.pdp-grid.css-qqclnk.ehf3nt20 > div.grid-item.product-imagery.pt12-md.d-sm-h.d-lg-b.css-gv5k5e.e4lt99o0.nds-grid-item > div',
      );
      try {
        await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        options.loggerScope?.error(`No gallery found on page`, {
          component: 'PageImageSourceNike',
          method: 'execute()',
          action: 'gallery.waitFor(...)',
          data: {
            href: href,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        throw new Error('Error. No gallery found on page');
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

      if (imageUrls.length === 0) {
        options.loggerScope?.error(`No valid image URLs found`, {
          component: 'PageImageSourceNike',
          method: 'execute()',
          action: 'gallery.waitFor(...)',
          data: {
            href: href,
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
