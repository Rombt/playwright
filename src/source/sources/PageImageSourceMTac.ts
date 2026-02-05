import { Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';

export default class PageImageSourceMTac implements ISource<ICollectProductPhotosTask> {
  supports(task: ICollectProductPhotosTask): boolean {
    return task.metadata.target_website === 'https://militarist.ua/ua/search/?q={{sku_prod}}';
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

      const image = page.locator('div.card_product-head > a').first(); //todo может быть много на странице получить и обработать все
      await image.waitFor({ state: 'visible', timeout: 5000 });
      await image.click();
      const gallery = page.locator(
        'div.catalog-item-gallery > div > div.big-img.slider-for.slick-initialized.slick-slider > div > div',
      );
      try {
        await gallery.waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error('No gallery found on page');
      }

      const count = await gallery.count();
      if (count === 0) throw new Error('No images found on page');

      const firstImg = gallery.locator('img').first();
      await firstImg.waitFor({ state: 'visible', timeout: 15000 });

      const imageUrls = await gallery
        .locator('img')
        .evaluateAll(imgs =>
          imgs
            .filter((img): img is HTMLImageElement => img instanceof HTMLImageElement)
            .map(img => img.src),
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

    console.log('==========>>  data = ', data);

    return { data, errors };
  }
}
