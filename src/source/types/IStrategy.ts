import { IExecutionContext } from './IExecutionContext';

export interface IStrategy<TParams = unknown, TResult = unknown> {
  name: string;

  canHandle(ctx: IExecutionContext): Promise<boolean>;

  score(ctx: IExecutionContext): Promise<number>;

  execute(ctx: IExecutionContext, params?: TParams): Promise<TResult>;
}
