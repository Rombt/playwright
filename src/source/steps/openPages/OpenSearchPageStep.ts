import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { normalizeSku } from '../../../common/helpers';
import { IProduct } from '../../../data/entities/IProduct';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';

type OpenSearchPageParams = {
  product?: IProduct;
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
};

export default class OpenSearchPageStep extends BaseStep {
  public readonly name = 'OpenSearchPageStep';

  protected async execute(
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

    await ctx.page.goto(url, { waitUntil });

    // ctx.state.productUrl = url;
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('CheckSearchResultsStep'),
      // params: {
      //   sku: ctx.input.product?.sku,
      // },
    };
  }
}
