import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../types/ISourceOld';
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

export default class PageImageSourceNewBalance implements ISource<ICollectProductPhotosTask> {
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
    return task.metadata.target_website === 'https://newbalance.ua/store?page=1&s={{sku_prod}}';
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

    const rawSku = product.sku;
    const starIndex = rawSku.indexOf('*');
    const sku = (starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku).trim().toLowerCase();
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      // await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.goto(url, { waitUntil: 'networkidle' });

      //!!
      const link = page
        .locator(`ul.products > li.products__item div.product-item__image > a[href*="${sku}"]`)
        .first();

      const countLink = await link.count();
      this.logger?.debug(`The link is found on the page`, {
        component: 'PageImageSourceAvecs',
        method: 'execute()',
        action: 'link = page.locator(...)',
        data: {
          url: url,
          rawSku: rawSku,
          sku: sku,
          linkCount: countLink,
        },
      });

      //!!
      const empty = page.locator('div.no-result > h2.no-result__title ', {
        hasText: 'РЕЗУЛЬТАТІВ НЕ ЗНАЙДЕНО',
      });

      try {
        await Promise.race([
          link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
          empty.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
        ]);
      } catch {
        throw new Error(`Search result not resolved. ${sku}`);
      }

      if ((await empty.count()) > 0) {
        throw new Error(`Goods not found on the page. ${sku}`);
      }

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');

      const absoluteHref = new URL(relativeHref, page.url()).toString();
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
      // link.click(); // если page.goto(absoluteHref)  не сработал

      //!!
      const image = page.locator('#jsProductZoom > div.detail_photos_list > img').first();

      await image.waitFor({
        state: 'attached',
        timeout: this.config.asyncRetry.maxDelay,
      });

      // ---------  поиск описания  -------------
      const htmlCont = page.locator('section.descr-sec');
      await htmlCont
        .first()
        .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const htmlContCount = await htmlCont.count();
      if (htmlContCount === 0) {
        this.logger?.debug(`Description is absent`, {
          component: 'PageImageSource ...',
          method: 'execute()',
          action: 'const htmlCont = page.locator(...)',
          data: {
            sku: sku,
            url: url,
          },
        });
      }

      // ---  предварительная обработка  ---
      // блоки в которых буду искать
      const selectors = ['div.descr-sec__tabs'];

      const htmlParts: string[] = [];

      for (const selector of selectors) {
        const loc = page.locator(selector);

        if (await loc.count()) {
          const part = await loc.evaluate((el) => {
            // блоки которые будут удалены
            el.querySelectorAll('div.size-table , div.descr-sec__video, div.close, button').forEach(
              (e) => e.remove(),
            );

            return el.innerHTML;
          });

          htmlParts.push(part);
        }
      }

      html = htmlParts.join('\n');

      // ---------  сбор изображений  -------------

      image.click(); // для активации галереи
      // await page.waitForSelector('div.swiper-block div.swiper-wrapper > div.swiper-slide-active img', {
      //   state: 'visible',
      // });

      //!!
      const gallery = page.locator('div.swiper-block div.swiper-wrapper');
      await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      //!!
      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const imageUrls = await gallery.locator('div.swiper-slide').evaluateAll((slides) => {
        const getBestFromSrcset = (srcset: string) => {
          return srcset
            .split(',')
            .map((s) => s.trim().split(' ')[0])
            .pop(); // берём самое большое изображение
        };

        const urls = slides
          .map((slide) => {
            let url = null;

            // 1. Пробую source
            const source = slide.querySelector('source');
            if (source) {
              const srcset = source.getAttribute('srcset');
              if (srcset) {
                url = getBestFromSrcset(srcset);
              }
            }

            // 2. fallback → img[data-src]
            if (!url) {
              const img = slide.querySelector('img');

              if (img) {
                url = img.getAttribute('data-src') || img.getAttribute('src');
              }
            }

            return url;
          })
          .filter(Boolean);

        return Array.from(new Set(urls));
      });

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
