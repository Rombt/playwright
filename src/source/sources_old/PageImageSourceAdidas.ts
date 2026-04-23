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

export default class PageImageSourceAdidas implements ISource<ICollectProductPhotosTask> {
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
    return task.metadata.target_website === 'https://www.adidas.ua/search?s={{sku_prod}}';
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
        .locator(`div.product__content > div.product__image > a[href*="${sku}"]`)
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

      await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      // страница поиска не содержит характерных надписей на случай если товар не найден
      // по этому опираюсь только на наличие ссылки на страницу товара
      if ((await link.count()) === 0) {
        throw new Error('The page search does not match the product SKU. ' + sku);
      }

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');
      const absoluteHref = new URL(relativeHref, page.url()).toString();
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
      // link.click(); // если page.goto(absoluteHref)  не сработал

      //!!
      const image = page.locator('#gallery div.slick-track img').first();

      await image.waitFor({
        state: 'attached',
        timeout: this.config.asyncRetry.maxDelay,
      });

      //!!
      const gallery = page.locator('#gallery div.slick-track');
      await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      //!!
      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      const imageUrls = await gallery
        .locator('div.slick-slide div.product__image picture.image > img')
        .evaluateAll((imgs) => {
          const normalizeCloudinary = (url: string) => {
            return url
              .replace(/w_\d+/, 'w_1200') // ширина побольше
              .replace(/q_\d+/, 'q_100'); // максимальное качество
          };

          const urls = imgs
            .map((img) => {
              let url = null;

              const dataSrc = img.getAttribute('data-src');
              if (dataSrc) {
                url = dataSrc;
              } else {
                const dataSrcset = img.getAttribute('data-srcset');
                if (dataSrcset) {
                  url = dataSrcset.split(',')[0].trim().split(' ')[0];
                } else {
                  const src = img.getAttribute('src');
                  if (src && !src.includes('.svg')) {
                    url = src;
                  }
                }
              }

              return url ? normalizeCloudinary(url) : null;
            })
            .filter(Boolean);

          return Array.from(new Set(urls));
        });

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');

      images[sku] = imageUrls as IDataImagItem;
      images[sku].idProduct = product.id_product;

      // поиск описания
      const htmlCont = page.locator('#description');
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

      // удаляю лишнее
      const selectors = ['#description', '#care', '#bullets'];

      const htmlParts: string[] = [];

      for (const selector of selectors) {
        const loc = page.locator(selector);

        if (await loc.count()) {
          const part = await loc.evaluate((el) => {
            el.querySelectorAll('.description__image, h2, h3, .description__subtitle, svg').forEach(
              (e) => e.remove(),
            );

            return el.innerHTML;
          });

          htmlParts.push(part);
        }
      }

      html = htmlParts.join('\n');
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
