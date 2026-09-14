import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { IOpenSearchPageParams } from '../../types/IOpenSearchPageParams';

export default class OpenSearchPageStep extends BaseStep {
  public readonly name = 'OpenSearchPageStep';

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: IOpenSearchPageParams,
  ): Promise<void> {
    const stepConfig =
      (ctx.stepParams?.get(OpenSearchPageStep) as unknown as IOpenSearchPageParams) ?? params;

    console.log('stepConfig:', stepConfig);
    
    const strategyName = stepConfig?.strategy || 'DefaultOpenSearchPageStrategy';


    const strategy = ctx.strategyResolver.get<IOpenSearchPageParams, void>(strategyName);

    await strategy.execute(ctx, stepConfig);

    ctx.logger?.debug('Search page opened', {
      component: 'OpenSearchPageStep',
      method: 'execute()',
      action: 'strategy.execute',
      data: {
        strategy: strategy.name,
      },
    });
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    const stepConfig = ctx.stepParams?.get(OpenSearchPageStep) as unknown as IOpenSearchPageParams;

    return {
      step: ctx.stepFactory.create(stepConfig?.nextStep || 'CheckSearchResultsStep'),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
