import { IExecutionContext } from './IExecutionContext';
import { IActionResult } from '../types/IActionResult';

export interface IStrategy<TParams = unknown, TResult = unknown> {
  name: string;

  canHandle(ctx: IExecutionContext): Promise<boolean>;

  score(ctx: IExecutionContext): Promise<number>;

  execute(ctx: IExecutionContext, params?: TParams): Promise<TResult>;
}

/**
 * 
 * используется для:
 *   click
 *   scroll
 *   wait
 *   form actions
 * 
 */
export interface IActionStrategy<TParams = void, TResult = IActionResult>
  extends IStrategy<TParams, TResult> {}

/**
 * 
 * использовать для разнообразных преобразований донных url для страницы вариантов например
 * 
 */
export interface ITransformStrategy<TParams = unknown, TResult = unknown>
  extends IStrategy<TParams, TResult> {}  