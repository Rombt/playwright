import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { normalizeSku, fullClearSku } from '../../../common/helpers';
import { IProduct } from '../../../data/entities/IProduct';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { optimizePageResources } from '../../../common/helpers';

type OpenSearchPageParams = {
  product?: IProduct;
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  nextStep?: string;
  clearSku?: 'full';
};

export default class OpenSearchPageStep extends BaseStep {
  public readonly name = 'OpenSearchPageStep';
  private stepConfig!: OpenSearchPageParams;

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: OpenSearchPageParams,
  ): Promise<void> {
    const product = params?.product ?? ctx.input.product;

    this.stepConfig = ctx.stepParams?.get(OpenSearchPageStep) as unknown as OpenSearchPageParams;

    if (!product) {
      throw new Error('Product is undefined');
    }

    const baseUrl = ctx.task.metadata.target_website;
    if (!baseUrl) {
      throw new Error('target_website is not defined');
    }

    // для некоторых брендов может понадобится более радикальная очистка sku например Under Armour
    let sku = '';
    if (this.stepConfig?.clearSku === 'full') {
      sku = fullClearSku(product.sku);
    } else {
      sku = normalizeSku(product.sku);
    }

    const url = baseUrl.replace('{{sku_prod}}', sku);
    const waitUntil = params?.waitUntil ?? 'domcontentloaded';


    // для облегчения загрузки страницы отключаю всё не нужное
    await optimizePageResources(ctx);

    await ctx.page.goto(url, { waitUntil });

    // ctx.state.productUrl = url;
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    const nextStep = this.stepConfig?.nextStep || 'CheckSearchResultsStep';

    return {
      step: ctx.stepFactory.create(nextStep),
    };
  }
}
