import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { IStrategy } from '../../types/IStrategy';
import { IStrategyResolver } from '../../types/IStrategyResolver';
import { IPreparationSearchPageParams } from '../../types/IPreparationSearchPageParams';

export default class PreparationSearchPageStep extends BaseStep {
  public readonly name = 'PreparationSearchPageStep';

  constructor() {
    super();
  }

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: IPreparationSearchPageParams,
  ): Promise<void> {
    const stepConfig = ctx.stepParams?.get(
      PreparationSearchPageStep,
    ) as unknown as IPreparationSearchPageParams;

    const strategy = ctx.strategyResolver.get<IPreparationSearchPageParams>(stepConfig.strategy);

    // todo пока не понятно что именно делать с результатами простого действия
    const result = await strategy.execute(ctx, stepConfig);
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('CheckSearchResultsStep'),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
