import { IStrategy } from '../../types/IStrategy';
import { IExecutionContext } from '../../types/IExecutionContext';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { fullClearSku, normalizeSku, optimizePageResources } from '../../../common/helpers';
import { IOpenSearchPageParams } from '../../types/IOpenSearchPageParams';

export default class WaitForElementOpenSearchPageStrategy implements IStrategy<
  IOpenSearchPageParams,
  void
> {
  name = 'WaitForElementOpenSearchPageStrategy';

  async canHandle(ctx: IExecutionContext): Promise<boolean> {
    return true;
  }

  async score(): Promise<number> {
    return 10;
  }

  async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    params: IOpenSearchPageParams,
  ): Promise<void> {
    const product = ctx.input.product;

    if (!product) {
      throw new Error('Product is undefined');
    }

    const baseUrl = ctx.input.url;

    if (!baseUrl) {
      throw new Error('target_website is not defined');
    }

    const sku = params?.clearSku === 'full' ? fullClearSku(product.sku) : normalizeSku(product.sku);
    const url = baseUrl.replace('{{sku_prod}}', sku);
    const waitUntil = params?.waitUntil ?? 'domcontentloaded';

    await optimizePageResources(ctx);

    await ctx.page.goto(url, {
      waitUntil: 'commit',
    });

    if (params?.waitForSelector) {
      await ctx.page.locator(params.waitForSelector).first().waitFor({
        state: 'attached',
        timeout: ctx.appConfig.asyncRetry.maxDelay,
      });

      await ctx.page.evaluate(() => window.stop());
    } else {
      await ctx.page.goto(url, { waitUntil: waitUntil });
    }
  }
}
