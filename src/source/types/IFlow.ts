import { IExecutionContext } from './IExecutionContext';

export interface IFlow {
  run(ctx: IExecutionContext): Promise<void>;
}
