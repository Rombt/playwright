import { IExecutionContext } from './types/IExecutionContext';
import { IStrategyResolver } from './types/IStrategyResolver';
import { IStrategy } from './types/IStrategy';
import { BaseStep } from './BaseStep';
import { IStrategyStep } from './types/IStrategyStep';

export abstract class StrategyStep<TResult = unknown>
  extends BaseStep
  implements IStrategyStep<TResult>
{
  abstract strategies: IStrategy<TResult>[];

  constructor(public resolver: IStrategyResolver) {
    super();
  }

  protected async execute(ctx: IExecutionContext): Promise<void> {
    const strategy = await this.resolver.resolve(ctx, this.strategies, this.name);

    try {
      const result = await strategy.execute(ctx);

      await this.afterExecute(ctx, result, strategy);
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
    strategy: IStrategy<TResult>,
  ): Promise<void> | void;
}
