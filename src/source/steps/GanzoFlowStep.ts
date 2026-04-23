import { IActionsFactory } from '../types/IActionsFactory';
import { IExecutionContext } from '../types/IExecutionContext';
import { IStep } from '../types/IStep';
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';

export class GanzoFlowStep implements IStep {
  constructor(private actionsFactory: IActionsFactory) {}

  public readonly name = 'Ganzo';

  async run(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<void> {
    const page = ctx.page;
    const actions = ctx.actions;

    const product = ctx.input.product;
    if (!product) {
      throw new Error('Product is undefined');
    }

    // --- SKU нормализация ---
    const rawSku = product.sku;
    const starIndex = rawSku.indexOf('*');

    const sku =
      (starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku)?.replace(
        /^[\p{C}\s]+|[\p{C}\s]+$/gu,
        '',
      ) ?? '';

    const baseUrl = ctx.task.metadata.target_website!;
    const url = baseUrl.replace('{{sku_prod}}', sku);

    try {
      // --- открыть поиск ---
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const linkSelector = '#block-personal-content a.product-teaser__image--wrapper';

      const emptySelector = '.view-empty > p';

      await Promise.race([
        actions.waitForSelector(linkSelector),
        actions.waitForSelector(emptySelector),
      ]);

      if (await actions.exists(emptySelector)) {
        throw new Error(`Goods not found on the page. ${sku}`);
      }

      const relativeHref = await actions.getAttribute(linkSelector, 'href');
      if (!relativeHref) throw new Error('Product link not found');

      const absoluteHref = new URL(relativeHref, page.url()).toString();

      // --- открыть товар ---
      await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });

      const skuSelector = 'div.field-product-vendor-code__item';

      await actions.waitForSelector(skuSelector);

      const exists = await page.locator(skuSelector, { hasText: sku }).count();

      if (!exists) {
        throw new Error(`The page is not match sku ${sku}`);
      }

      // --- gallery ---
      const gallerySelector = '.product-gl__images';

      await actions.waitForSelector(gallerySelector);

      const imageUrls = await page
        .locator(`${gallerySelector} img`)
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')).filter(Boolean));

      if (!imageUrls.length) {
        throw new Error('No valid image URLs found');
      }

      const absoluteImageUrls = imageUrls.map((src) => new URL(src!, page.url()).toString());

      // --- description ---
      let html = '';

      try {
        const descSelector = 'div.field-product-desc__item.field__item';

        await actions.waitForSelector(descSelector);

        html = await page.locator(descSelector).evaluate((el) => {
          el.querySelectorAll('div').forEach((d) => d.remove());
          return el.innerHTML;
        });
      } catch {
        ctx.logger.debug('Description not found', {
          component: 'GanzoFlowStep',
        });
      }

      // --- save result ---
      ctx.state.images = absoluteImageUrls;

      ctx.state.html = html;
    } catch (error) {
      ctx.errors.push({
        error,
        product,
        targetUrl: url,
      });
    }
  }

  next(): IStep | null {
    return null;
  }
}
