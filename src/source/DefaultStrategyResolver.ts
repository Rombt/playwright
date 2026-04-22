import { IExecutionContext } from './types/IExecutionContext';
import { IStrategyResolver } from './types/IStrategyResolver';
import { IStrategy } from './types/IStrategy';

export class DefaultStrategyResolver implements IStrategyResolver {
  async resolve<T>(
    ctx: IExecutionContext,
    strategies: IStrategy<T>[],
    stepName: string,
  ): Promise<IStrategy<T>> {
    const candidates: Array<{
      strategy: IStrategy<T>;
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

    // помечаем выбранную
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
}
