import { APIRequestContext, Page, Locator } from 'playwright-core';
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

export default class PageImageSourceJackWolfskin implements ISource<ICollectProductPhotosTask> {
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
    return task.metadata.target_website === 'https://www.jack-wolfskin.com/search/?q={{sku_prod}}';
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

    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      try {
        const acceptBtn = page.locator('button[aria-label="Accept All"]');
        await acceptBtn.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
        await acceptBtn.click();
        await acceptBtn.waitFor({ state: 'detached' });
      } catch (e) {
        // кнопки нет — игнорируем
      }
      await page.mouse.click(100, 100);

      const link = page.locator('div.jwsdw-pop-image-wrapper > a.jwsdw-pop-image-link').first();

      const empty = page.locator('div.jwsdw-pageWrapper h1', {
        hasText: 'We’ve got sidetracked somehow',
      });

      try {
        await Promise.race([
          link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
          empty.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
        ]);
      } catch (err) {
        this.logger?.debug(`**Search result not resolved. ${sku}`, {
          component: 'PageImageSourceJackWolfskin',
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

      const page_sku = page.locator(
        'ul.jws-accordionWrapper > li.jwsdw-productDetail-description span[data-product-id]',
        {
          hasText: `${sku}`,
        },
      );

      await page_sku
        .first()
        .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });

      if ((await page_sku.count()) === 0) {
        throw new Error(`The page is not match sku  ${sku}`);
      }

      const image = page
        .locator('div[aria-label="Product image gallery"] img.jwsdw-pdp-mediaItem-image')
        .first();

      await image.waitFor({
        state: 'visible',
        timeout: this.config.asyncRetry.maxDelay,
      });

      const imageUrlsSet = new Set<string>();

      // --- первая галерея ---
      const initialImages = await this.processingGallery(page);
      for (const img of initialImages) {
        imageUrlsSet.add(img);
      }

      const swatchColors = page.locator(
        '[aria-label="Color selection"] > button.jwsdw-product-color-btn',
      );
      await swatchColors.first().waitFor();

      const swatchCount = await swatchColors.count();

      // --- если нет цветов ---
      if (swatchCount === 0) {
        this.logger?.debug(`swatchColors not found`, {
          component: 'PageImageSourceColumbia',
          method: 'execute()',
          action:
            'const swatchColors = page.locator(\'[aria-label="Color selection"] > button.jwsdw-product-color-btn\')',
          data: {
            url: url,
            originalSKU: product.sku,
            sku: sku,
          },
        });

        const imageUrls = Array.from(imageUrlsSet) as IDataImagItem;
        imageUrls.idProduct = product.id_product;

        images[sku] = imageUrls;
      } else {
        await swatchColors.first().waitFor({
          state: 'visible',
          timeout: this.config.asyncRetry.maxDelay,
        });

        for (let i = 0; i < swatchCount; i++) {
          const swatch = swatchColors.nth(i);

          // пропускаем уже активный цвет
          const isActive = await swatch.getAttribute('aria-checked'); //!!
          if (isActive === 'true') continue;

          const prevSrc = await image.getAttribute('src');

          await swatch.click();

          // ждём либо смену картинки, либо таймаут fallback
          try {
            await page.waitForFunction(
              (prev) => {
                const img = document.querySelector(
                  'div[aria-label="Product image gallery"] img.jwsdw-pdp-mediaItem-image',
                ); //!!
                return img && img.getAttribute('src') !== prev;
              },
              prevSrc,
              { timeout: 5000 },
            );
          } catch {
            // fallback если сайт не меняет src (часто бывает)
            await page.waitForTimeout(500);
          }

          const newImages = await this.processingGallery(page);

          for (const img of newImages) {
            imageUrlsSet.add(img);
          }

          await limiter.sleepNormal(
            this.config.asyncRetry.baseDelay,
            this.config.asyncRetry.maxDelay,
          );
        }

        const imageUrls = Array.from(imageUrlsSet) as IDataImagItem;
        imageUrls.idProduct = product.id_product;

        images[sku] = imageUrls;
      }
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
  private async processingGallery(page: Page): Promise<string[]> {
    const gallery = page.locator('div[aria-label="Product image gallery"]');
    try {
      await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
    } catch (error) {
      throw new Error('No gallery found on page');
    }

    const count = await gallery.count();
    if (count === 0) throw new Error('No images found on page');

    const firstImg = gallery.locator('img').first();
    await firstImg.waitFor({ state: 'attached', timeout: 15000 });

    //!!!!!!!!!!!!!!!!!!!!!!!!!
    const imageUrls = await gallery
      .locator('img')
      .evaluateAll((imgs: Element[]) =>
        imgs
          .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
          .map((img) => img.src),
      );

    if (imageUrls.length === 0) throw new Error('No valid image URLs found');

    return imageUrls;
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
