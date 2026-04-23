import { IFlowRunner } from './IFlowRunner';
import { IStrategyResolver } from './IStrategyResolver';
import { IActionsFactory } from './IActionsFactory';
import { ILogger } from '../../data/logger/types/ILogger';

export interface ISourceDependencies {
  flowRunner: IFlowRunner;
  resolver: IStrategyResolver;
  actionsFactory: IActionsFactory;
  logger: ILogger;
}
