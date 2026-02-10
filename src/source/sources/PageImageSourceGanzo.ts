import { Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';

export default class PageImageSourceGanzo implements ISource<ICollectProductPhotosTask> {
  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
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
    const sku =
      (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
        /^[\p{C}\s]+|[\p{C}\s]+$/gu,
        '',
      ) ?? '';
    const url = targetUrl.replace('{{sku_prod}}', sku);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const link = page
        .locator(
          '#block-personal-content > div > div > div > div > div > div > div > div.product-teaser__top > div > div.product-teaser__image--wrapper > a',
        )
        .first();

      await link.waitFor({ state: 'attached', timeout: 30000 });

      const relativeHref = await link.getAttribute('href');
      if (!relativeHref) throw new Error('Product link not found');
      const absoluteHref = new URL(relativeHref, page.url()).toString();

      console.log('===>>  absoluteHref = ', absoluteHref);
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      const gallery = page.locator(
        '#block-personal-content > div > div > div > div.product-full__top > div.product-full__top--left.product-full__top-item > div.product-full__gallery.swiper-arrow-style-2.swiper-arrow-style-min > div > div.product-gl__images',
      );
      try {
        await gallery.waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'attached', timeout: 15000 });

      const imageUrls = await gallery
        .locator('img')
        .evaluateAll(imgs => imgs.map(img => img.getAttribute('src')).filter(Boolean));

      const absoluteImageUrls = imageUrls.map(src => new URL(src!, page.url()).toString());

      if (absoluteImageUrls.length === 0) throw new Error('No valid image URLs found');

      data[sku] = absoluteImageUrls;
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
