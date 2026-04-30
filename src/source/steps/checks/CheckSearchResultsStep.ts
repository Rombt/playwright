import { IExecutionContext } from '../../types/IExecutionContext';
import { BaseStep } from '../../BaseStep';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { AppConfig } from '../../../data/config/appConfig';
import { IStepResult } from '../../types/IStepResult';
import { IStrategy } from '../../types/IStrategy';
import { IStrategyResolver } from '../../types/IStrategyResolver';
import { CheckSearchResultsParams, SearchResult } from '../../types/ICheckSearchResults';

export default class CheckSearchResultsStep extends BaseStep {
  public readonly name = 'CheckSearchResultsStep';

  constructor() {
    super();
  }

  protected async execute(
    ctx: IExecutionContext<ICollectProductPhotosTask>,
    config: AppConfig,
    params?: CheckSearchResultsParams,
  ): Promise<void> {
    const stepConfig = ctx.stepParams?.get(
      CheckSearchResultsStep,
    ) as unknown as CheckSearchResultsParams;

    const strategy = ctx.strategyResolver.get<CheckSearchResultsParams, SearchResult>(
      stepConfig.strategy,
    );

    const result = await strategy.execute(ctx, stepConfig);
    ctx.state.urlProductPage = result.productUrl;

    ctx.logger?.debug('URL product page is received', {
      component: 'CheckSearchResultsStep',
      method: 'execute()',
      action: 'strategy.execute',
      data: {
        strategy: strategy.name,
        _strategy: strategy,
        result: result,
      },
    });
  }

  next(ctx: IExecutionContext): IStepResult | null {
    if (ctx.control.stop) return null;

    return {
      step: ctx.stepFactory.create('OpenProductPageStep'),
      params: {
        sku: ctx.input.product?.sku,
      },
    };
  }
}
