import { IExecutionContext } from '../../types/IExecutionContext';
import { IStep } from '../../types/IStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { normalizeSku } from '../../../common/helpers';
import { IProduct } from '../../../data/entities/IProduct';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';

type OpenSearchPageParams = {
  product?: IProduct;
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
};

export default class OpenSearchPageStep implements IStep<OpenSearchPageParams> {
  public readonly name = 'OpenSearchPageStep';

  async run(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: OpenSearchPageParams,
  ): Promise<void> {
    const product = params?.product ?? ctx.input.product;

    if (!product) {
      throw new Error('Product is undefined');
    }

    const baseUrl = ctx.task.metadata.target_website;
    if (!baseUrl) {
      throw new Error('target_website is not defined');
    }

    const sku = normalizeSku(product.sku);
    const url = baseUrl.replace('{{sku_prod}}', sku);

    const waitUntil = params?.waitUntil ?? 'domcontentloaded';

    try {
      await ctx.page.goto(url, { waitUntil });

      ctx.state.productUrl = url;
    } catch (error) {
      ctx.errors.push({
        error,
        product,
        targetUrl: url,
      });

      ctx.control.stop = true;
    }
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('CheckSearchResultsStep'),
      params: {
        sku: ctx.input.product?.sku, // runtime-only
      },
    };
  }
}
