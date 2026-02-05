import { Page } from 'playwright-core';
import { ISource } from '../ISource';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IProduct } from '../../data/entities/IProduct';
import { IDataImag } from '../../data/entities/IDataImag';

export default class PageImageSourcePuma implements ISource<ICollectProductPhotosTask> {
  supports(task: ICollectProductPhotosTask): boolean {
    return (
      task.metadata.target_website === 'https://ua.puma.com/uk/catalogsearch/result/?q={{sku_prod}}'
    );
  }

  async worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<IWorkerResult[]> {
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

      const galleries = page.locator('figure.zoom-image-gallery__figure');

      try {
        await galleries.first().waitFor({ state: 'attached', timeout: 15000 });
      } catch (error) {
        throw new Error(`No gallery found on page: ${error}`);
      }

      const imageUrls: string[] = await galleries.evaluateAll(figures =>
        figures
          .map(fig => {
            const img = fig.querySelector('img');

            if (img?.currentSrc && !img.currentSrc.startsWith('data:')) return img.currentSrc;
            const src = img?.getAttribute('src');
            if (src && !src.startsWith('data:')) return src;
            const lazy = img?.getAttribute('data-lazy');
            if (lazy) return lazy;
            return fig.getAttribute('data-large-img');
          })
          // вот type guard для TS
          .filter((url): url is string => url !== null && url !== undefined),
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

    return { data, errors };
  }
}
