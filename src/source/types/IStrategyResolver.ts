import { IExecutionContext } from './IExecutionContext';
import { IStrategy } from './IStrategy';

export interface IStrategyResolver {
  resolve<T>(
    ctx: IExecutionContext,
    strategies: IStrategy<T>[],
    stepName: string,
  ): Promise<IStrategy<T>>;
}
