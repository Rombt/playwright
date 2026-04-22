import { IExecutionContext } from './IExecutionContext';

export interface IStep {
  name: string;

  run(ctx: IExecutionContext): Promise<void>;

  next(ctx: IExecutionContext): IStep | null;
}
