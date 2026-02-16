import { APIRequestContext, Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';

export default class PageImageSourceAdidas implements ISource<ICollectProductPhotosTask> {
  executeHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    product: IProduct,
  ): Promise<IWorkerResult> {
    throw new Error('Method not implemented.');
  }
  workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<unknown[]> {
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

  async execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult> {
    const errors: IWorkerError[] = [];
    const data: IDataImag = {};

    const rawSku = product.sku;
    const starIndex = rawSku.indexOf('*');
    const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const link = page
        .locator('div.list.store__list > div > div > div.product__image > a')
        .first();

      await link.waitFor({ state: 'attached', timeout: 30000 });

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');
      const absoluteHref = new URL(relativeHref, page.url()).toString();

      console.log('===>>  absoluteHref = ', absoluteHref);
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator(
        '#gallery > div > div.slider__carousel.slick-slider.slick-initialized > div > div',
      );
      try {
        await gallery.waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const images = gallery.locator('img');
      await images.first().waitFor({ state: 'attached', timeout: 15000 });

      const imageUrls = await images.evaluateAll(imgs =>
        imgs
          .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
          .map(img => img.getAttribute('data-src') || img.getAttribute('data-srcset'))
          .filter((src): src is string => Boolean(src)),
      );

      if (imageUrls.length === 0) throw new Error('No valid image URLs found');

      data[sku] = imageUrls;
    } catch (err) {
      errors.push({
        error: err,
        product: product,
        url: url,
      } as IWorkerError);
    }

    console.log('==>> data: ', data);

    return { data, errors };
  }
}
