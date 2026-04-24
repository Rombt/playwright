import { IExecutionContext } from '../../types/IExecutionContext';
import { IStep } from '../../types/IStep';
import { IDataImag, IDataImagItem } from '../../../data/entities/IDataImag';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';

export default class OpenSearchPage implements IStep {
  public readonly name = 'OpenSearchPage';

  async run(ctx: IExecutionContext<ICollectProductPhotosTask>): Promise<void> {
    const { page } = ctx;

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
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const linkSelector = '#block-personal-content a.product-teaser__image--wrapper';
      const emptySelector = '.view-empty > p';

      //todo убрать actions
      // await Promise.race([
      //   actions.waitForSelector(linkSelector),
      //   actions.waitForSelector(emptySelector),
      // ]);

      // if (await actions.exists(emptySelector)) {
      //   throw new Error(`Goods not found on the page. ${sku}`);
      // }

      const relativeHref = await actions.getAttribute(linkSelector, 'href');
      if (!relativeHref) {
        throw new Error('Product link not found');
      }

      const absoluteHref = new URL(relativeHref, page.url()).toString();

      // ✅ сохраняем в state
      ctx.state.productUrl = absoluteHref;
    } catch (error) {
      ctx.errors.push({
        error,
        product,
        targetUrl: url,
      });

      // ✅ останавливаем flow
      ctx.control.stop = true;
    }
  }

  next(ctx: IExecutionContext): IStep | null {
    if (ctx.control.stop) {
      return null;
    }

    // 👉 имя следующего шага должно быть реальным
    return ctx.stepFactory.create('FindProductLinkStep');
  }
}
