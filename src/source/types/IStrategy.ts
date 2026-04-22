import { IExecutionContext } from './IExecutionContext';

export interface IStrategy<TResult = unknown> {
  name: string;

  canHandle(ctx: IExecutionContext): Promise<boolean>;

  score(ctx: IExecutionContext): Promise<number>;

  execute(ctx: IExecutionContext): Promise<TResult>;
}
