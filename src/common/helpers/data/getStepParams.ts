import { IExecutionContext, IStepConstructor } from '../../../source';

export function getStepParams<T>(ctx: IExecutionContext, step: IStepConstructor): T {
  if (!ctx.stepParams) {
    throw new Error('stepParams is not initialized');
  }

  const params = ctx.stepParams.get(step);

  if (!params) {
    throw new Error(`Missing params for step ${step.name}`);
  }

  return params as T;
}
