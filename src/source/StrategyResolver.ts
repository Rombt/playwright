import { IExecutionContext } from './types/IExecutionContext';
import { IStrategyResolver } from './types/IStrategyResolver';
import { IStrategy } from './types/IStrategy';

export class StrategyResolver implements IStrategyResolver {
  constructor(private registry: Map<string, IStrategy<any, any>>) {}

  async resolve<TParams, TResult>(
    ctx: IExecutionContext,
    stepName: string,
  ): Promise<IStrategy<TParams, TResult>> {
    const strategies = Array.from(this.registry.values()) as IStrategy<TParams, TResult>[];

    const candidates: Array<{
      strategy: IStrategy<TParams, TResult>;
      score: number;
    }> = [];

    for (const strategy of strategies) {
      try {
        const canHandle = await strategy.canHandle(ctx);

        if (!canHandle) continue;

        const score = await strategy.score(ctx);

        candidates.push({ strategy, score });

        ctx.debug.strategies.push({
          step: stepName,
          strategy: strategy.name,
          score,
          selected: false,
        });
      } catch (error) {
        ctx.logger.warn('Strategy evaluation failed', {
          step: stepName,
          strategy: strategy.name,
          error,
        });
      }
    }

    if (candidates.length === 0) {
      ctx.logger.warn('No strategies matched, using fallback', {
        step: stepName,
      });

      const fallback = strategies[0];

      ctx.debug.strategies.push({
        step: stepName,
        strategy: fallback.name,
        score: 0,
        selected: true,
      });

      return fallback;
    }

    candidates.sort((a, b) => b.score - a.score);

    const selected = candidates[0].strategy;

    const debugEntries = ctx.debug.strategies.filter((s) => s.step === stepName);

    for (const entry of debugEntries) {
      if (entry.strategy === selected.name) {
        entry.selected = true;
      }
    }

    ctx.logger.debug('Strategy selected', {
      step: stepName,
      strategy: selected.name,
      score: candidates[0].score,
    });

    return selected;
  }

  get<TParams, TResult>(name: string): IStrategy<TParams, TResult> {
    console.log('this.registry = '); //!!--!!
    console.dir(this.registry, { depth: null, colors: true }); //!!--!!

    const strategy = this.registry.get(name);

    if (!strategy) {
      throw new Error(`Strategy not found: "${name}"`);
    }

    return strategy as IStrategy<TParams, TResult>;
  }
}
