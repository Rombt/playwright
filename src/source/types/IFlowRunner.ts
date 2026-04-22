import { IExecutionContext } from './IExecutionContext';
import { IStep } from './IStep';

export interface IFlowRunner {
  run(startStep: IStep, ctx: IExecutionContext): Promise<void>;
}
