import { APIRequestContext, Page } from 'playwright-core';
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

export default class PageImageSourceJoma implements ISource<ICollectProductPhotosTask> {
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
    return task.metadata.target_website === 'https://joma.ua/search/?q={{sku_prod}}';
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
    let html: string = '';

    const rawSku = product.sku;
    const sku = rawSku.split(/[*-]/)[0];
    const partsSku = rawSku.split(/[.-]/); // ["100052", "700"]
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      let locatorLink;

      if (partsSku.length > 1) {
        locatorLink = page.locator(
          `div.category > div.category-content > div.category-item > a[href*="${partsSku[0]}"][href*="${partsSku[1]}"]`,
        );
      } else {
        locatorLink = page.locator(
          `div.category > div.category-content > div.category-item > a[href*="${partsSku[0]}"]`,
        );
      }

      const link = locatorLink.first();

      const countLink = await link.count();
      this.logger?.debug(`The link is found on the page`, {
        component: 'PageImageSourceJoma',
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

      //!!
      const image = page
        .locator('div.product__column > div.slider ul.splide__list > li.splide__slide img')
        .first();

      await image.waitFor({
        state: 'attached',
        timeout: this.config.asyncRetry.maxDelay,
      });

      //!!
      const gallery = page.locator('div.product__column > div.slider ul.splide__list');

      try {
        await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const imgs = gallery.locator('li.splide__slide img');

      const countImgs = await imgs.count();
      this.logger?.debug(`The imgs is found on the page`, {
        component: 'PageImageSourceJoma',
        method: 'execute()',
        action: 'imgs = page.locator(...)',
        data: {
          url: url,
          rawSku: rawSku,
          sku: sku,
          imgsCount: countImgs,
        },
      });

      const srcs = await imgs.evaluateAll((elements) =>
        elements.map((el) => el.getAttribute('src') || ''),
      );

      const baseUrl = page.url();

      const absoluteImageUrls = srcs
        .map((src) => (src ? new URL(src, baseUrl).href : null))
        .filter(Boolean);

      if (absoluteImageUrls.length === 0) throw new Error('No valid image URLs found');

      images[sku] = absoluteImageUrls as IDataImagItem;
      images[sku].idProduct = product.id_product;

      // поиск описания
      const htmlCont = page.locator('div.product__column > div.product__description');
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

      html = await htmlCont.innerHTML({ timeout: this.config.asyncRetry.maxDelay });
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
