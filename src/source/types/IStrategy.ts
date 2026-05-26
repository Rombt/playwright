import { IExecutionContext } from './IExecutionContext';
import { IActionResult } from '../types/IActionResult';

export interface IStrategy<TParams = unknown, TResult = unknown> {
  name: string;

  canHandle(ctx: IExecutionContext): Promise<boolean>;

  score(ctx: IExecutionContext): Promise<number>;

  execute(ctx: IExecutionContext, params?: TParams): Promise<TResult>;
}

export interface IActionStrategy<TParams = void, TResult = IActionResult>
  extends IStrategy<TParams, TResult> {}
