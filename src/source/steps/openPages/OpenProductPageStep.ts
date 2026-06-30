// import { Page } from 'playwright-core';
import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { getAbsoluteHref } from '../../../common/helpers';
import { IProduct } from '../../../data/entities/IProduct';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { IOpenProductPageParams } from '../../types/IOpenProductPageParams';
import { optimizePageResources } from '../../../common/helpers';

export default class OpenProductPageStep extends BaseStep {
  public readonly name = 'OpenProductPageStep';
  private stepConfig!: IOpenProductPageParams;

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: IOpenProductPageParams,
  ): Promise<void> {
    let urlProductPage = ctx.state.urlProductPage as string;

    if (!urlProductPage) {
      throw new Error('productUrl is not found in state');
    }

    this.stepConfig = ctx.stepParams?.get(OpenProductPageStep) as unknown as IOpenProductPageParams;

    if (this.stepConfig?.strategy) {
      const strategy = ctx.strategyResolver.get<IOpenProductPageParams, string>(
        this.stepConfig.strategy,
      );

      /**
       * для разных брендов могут понадобится разные стратегии,
       * так для некоторых брендов может понадобится перестраивать urlProductPage
       * под конкретный вариант, например Under Armour
       */
      if (this.stepConfig.strategy === 'GetUrlVariantPageStrategy' && strategy) {
        urlProductPage = await strategy.execute(ctx, this.stepConfig);
      }
    }

    // для облегчения загрузки страницы отключаю всё не нужное
    await optimizePageResources(ctx);

    await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    const nextStep = this.stepConfig?.nextStep || 'CheckPageSkuStep';

    return {
      step: ctx.stepFactory.create(nextStep),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
