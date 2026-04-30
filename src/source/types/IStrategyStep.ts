import { IStrategy } from './IStrategy';
import { IStrategyResolver } from './IStrategyResolver';

export interface IStrategyStep<TParams = unknown, TResult = unknown> {
  resolver: IStrategyResolver;
}
