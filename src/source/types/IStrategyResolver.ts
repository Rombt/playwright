import { IExecutionContext } from './IExecutionContext';
import { IStrategy } from './IStrategy';

export interface IStrategyResolver {
  resolve<TParams, TResult>(
    ctx: IExecutionContext,
    stepName: string,
  ): Promise<IStrategy<TParams, TResult>>;

  get<TParams, TResult>(name: string): IStrategy<TParams, TResult>;
}
