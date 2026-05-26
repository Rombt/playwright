import { IExecutionContext } from './IExecutionContext';
import { IStrategy } from './IStrategy';

export interface IStrategyResolver {
  resolve<TParams, TResult = unknown>(
    ctx: IExecutionContext,
    stepName: string,
  ): Promise<IStrategy<TParams, TResult>>;

  get<TParams, TResult = unknown>(name: string): IStrategy<TParams, TResult>;
}
