import { IFlowRunner } from './types/IFlowRunner';
import { IExecutionContext } from './types/IExecutionContext';
import { IStep } from './types/IStep';
import { IStepResult } from './types/IStepResult';
import { AppConfig } from '../data/config/appConfig';

import { IStepConstructor, StepParamsMap } from './types/IStepConstructor';

export class FlowRunner implements IFlowRunner {
  constructor(private config: AppConfig) {}

  private resolveParams(step: IStep, ctx: IExecutionContext, runtimeParams?: unknown): unknown {
    const map = ctx.stepParams;
    if (!map) return runtimeParams;

    const stepCtor = step.constructor as IStepConstructor;

    // приоритет:
    // 1. runtime params (из next)
    // 2. конкретный шаг
    // 3. глобальные (*)

    if (runtimeParams !== undefined) return runtimeParams;

    if (map.has(stepCtor)) {
      return map.get(stepCtor);
    }

    if (map.has('*')) {
      return map.get('*');
    }

    return undefined;
  }

  async run(startStep: IStep, ctx: IExecutionContext): Promise<void> {
    let current: IStepResult | null = {
      step: startStep,
      params: undefined,
    };

    while (current) {
      if (ctx.control.stop) {
        ctx.logger.warn('Flow stopped manually', {
          step: current.step.name,
        });
        break;
      }

      const resolvedParams = this.resolveParams(current.step, ctx, current.params);

      ctx.logger.debug('Step start', {
        step: current.step.name,
        stage: 'start',
        params: resolvedParams,
      });

      try {
        await current.step.run(ctx, this.config, resolvedParams);
      } catch (error) {
        ctx.logger.error('Step failed', {
          step: current.step.name,
          error,
        });

        ctx.errors.push({
          error,
          product: ctx.input.product,
          targetUrl: ctx.state.productUrl,
        });
      }

      ctx.logger.debug('Step finish', {
        step: current.step.name,
        stage: 'finish',
      });

      let next = current.step.next(ctx, this.config);

      if (ctx.control.skipNext && next) {
        ctx.control.skipNext = false;
        next = next.step.next(ctx, this.config);
      }

      current = next;
    }

    ctx.logger.debug('Flow finished', {
      stage: 'done',
    });
  }
}
