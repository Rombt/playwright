import { IExecutionContext } from './types/IExecutionContext';
import { IStrategyResolver } from './types/IStrategyResolver';
import { IStrategy } from './types/IStrategy';
import { BaseStep } from './BaseStep';
import { IStrategyStep } from './types/IStrategyStep';
import { AppConfig } from '../data/config/appConfig';

export abstract class StrategyStep<TParams = unknown, TResult = unknown> extends BaseStep {
  constructor(protected readonly resolver: IStrategyResolver) {
    super();
  }

  protected async execute(
    ctx: IExecutionContext,
    config: AppConfig,
    params?: TParams,
  ): Promise<void> {
    const strategy = await this.resolver.resolve<TParams, TResult>(ctx, this.name);

    try {
      const result = await strategy.execute(ctx, params);

      await this.afterExecute(ctx, result, strategy, params as TParams);
    } catch (error) {
      ctx.logger.error('Strategy execution failed', {
        step: this.name,
        strategy: strategy.name,
        error,
      });

      ctx.errors.push({
        error,
        product: ctx.input.product,
        targetUrl: ctx.state.productUrl,
      });
    }
  }

  protected abstract afterExecute(
    ctx: IExecutionContext,
    result: TResult,
    strategy: IStrategy<TParams, TResult>,
    params: TParams,
  ): Promise<void> | void;
}
