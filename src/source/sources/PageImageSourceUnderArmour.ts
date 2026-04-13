import { APIRequestContext, Page, Locator } from 'playwright-core';
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

export default class PageImageSourceUnderArmour implements ISource<ICollectProductPhotosTask> {
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor() {
    this.config = AppConfig.getInstance();
    this.logger = Logger.getInstance();
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
    return (
      task.metadata.target_website === 'https://www.underarmour.com/en-us/search/?q={{sku_prod}}'
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
    const images: IDataImag = {};
    let html = '';

    const limiter = new RateLimiter(this.config.asyncRetry.maxDelay);

    // нормализация SKU
    const rawSku = product.sku;
    const sku = rawSku.includes('*') ? rawSku.split('*')[0] : rawSku;
    const [id, variant] = sku.split('-');

    const url = targetUrl.replace('{{sku_prod}}', id);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      //!!
      const link = page
        .locator(
          `div[data-testid="product-tile-container"] a.ProductTile-module-scss-module__YG6sUW__product-image-link[href*="${id}"]`,
        )
        .first();

      const countLink = await link.count();
      this.logger?.debug(`The link is found on the page`, {
        component: 'PageImageSourceUnderArmour',
        method: 'execute()',
        action: 'link = page.locator(...)',
        data: {
          url: url,
          rawSku: rawSku,
          sku: sku,
          id: id,
          variant: variant,
          linkCount: countLink,
        },
      });

      const empty = page.locator('div[data-testid="empty-search-result"] > span', {
        hasText: 'Sorry, no results for',
      });

      try {
        await Promise.race([
          link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
          empty.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
        ]);
      } catch (err) {
        this.logger?.debug(`**Search result not resolved. ${sku}`, {
          component: 'PageImageSourceUnderArmour',
          method: 'execute()',
          action: 'await Promise.race([...])',
          data: {
            url: url,
            err: err,
          },
        });

        throw new Error(`Search result not resolved. ${sku}`);
      }

      if ((await empty.count()) > 0) {
        throw new Error(`Goods not found on the page. ${sku}`);
      }

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');

      const absoluteHref = new URL(relativeHref, page.url()).toString();
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      //!!
      // проверка соответствия страницы запрашиваемому sku
      const input_page_sku = page.locator(`input[name="colors"][value="${variant}"]`);
      await input_page_sku.waitFor();

      const id_input_page_sku = await input_page_sku.getAttribute('id');
      const label_page_sku = page.locator(`label[for="${id_input_page_sku}"]`);

      await label_page_sku.click();

      //!!
      const image = page
        .locator(
          `div.ProductImages-module-scss-module__NG3QBq__pdpImages div.swiper-wrapper div.swiper-slide img[src*="${id}-${variant}"]`,
        )
        .first();

      await image.waitFor({
        state: 'visible',
        timeout: this.config.asyncRetry.maxDelay,
      });
      //!!
      // галерея
      const gallery = page.locator(
        'div.ProductImages-module-scss-module__NG3QBq__pdpImages div.swiper-wrapper',
      );

      await gallery.waitFor({
        state: 'attached',
        timeout: this.config.asyncRetry.maxDelay,
      });

      // прогружаем все слайды (Swiper lazy)
      const slides = await page.locator('div.swiper-slide').all();
      for (const slide of slides) {
        await slide.scrollIntoViewIfNeeded();
      }

      // локатор картинок (НЕ называем images!)
      const imageElements = gallery.locator('img');

      await imageElements.first().waitFor({
        state: 'attached',
        timeout: this.config.asyncRetry.maxDelay,
      });

      // извлечение URL
      const imageUrls = await imageElements.evaluateAll((imgs) => {
        const normalizeScene7 = (url: string) => {
          try {
            const u = new URL(url);

            // максимум качества
            u.searchParams.set('wid', '2000');
            u.searchParams.set('hei', '2000');
            u.searchParams.set('qlt', '100');
            u.searchParams.set('scl', '1');
            u.searchParams.set('fmt', 'jpg');

            return u.toString();
          } catch {
            return url;
          }
        };

        const extractBestUrl = (img: HTMLImageElement) => {
          // 1. data-src
          const dataSrc = img.getAttribute('data-src');
          if (dataSrc) return dataSrc;

          // 2. data-srcset (берём самый большой)
          const dataSrcset = img.getAttribute('data-srcset');
          if (dataSrcset) {
            const parts = dataSrcset.split(',');
            return parts[parts.length - 1].trim().split(' ')[0];
          }

          // 3. srcset
          const srcset = img.getAttribute('srcset');
          if (srcset) {
            const parts = srcset.split(',');
            return parts[parts.length - 1].trim().split(' ')[0];
          }

          // 4. fallback src
          const src = img.getAttribute('src');
          if (src && !src.includes('.svg')) return src;

          return null;
        };

        const urls = imgs
          .map((img) => {
            const rawUrl = extractBestUrl(img as HTMLImageElement);
            return rawUrl ? normalizeScene7(rawUrl) : null;
          })
          .filter((url): url is string => Boolean(url));

        // убираем дубликаты
        return Array.from(new Set(urls));
      });

      // проверка
      if (imageUrls.length === 0) {
        throw new Error('No valid image URLs found');
      }

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');

      images[sku] = imageUrls as IDataImagItem;
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
