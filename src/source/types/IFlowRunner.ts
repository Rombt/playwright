import { IExecutionContext } from './IExecutionContext';
import { IStep } from './IStep';
import { AppConfig } from '../../data/config/appConfig';

export interface IFlowRunner {
  run(startStep: IStep, ctx: IExecutionContext): Promise<void>;
}
