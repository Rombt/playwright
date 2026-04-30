import { IFlowRunner } from './IFlowRunner';
import { IStrategyResolver } from './IStrategyResolver';
import { ILogger } from '../../data/logger/types/ILogger';

export interface ISourceDependencies {
  flowRunner: IFlowRunner;
  logger: ILogger;
}
