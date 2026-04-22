import { IStrategy } from './IStrategy';
import { IStrategyResolver } from './IStrategyResolver';

export interface IStrategyStep<TResult = unknown> {
  strategies: IStrategy<TResult>[];
  resolver: IStrategyResolver;
}
