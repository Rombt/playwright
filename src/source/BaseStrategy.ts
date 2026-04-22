import { IExecutionContext } from './types/IExecutionContext';
import { IStrategy } from './types/IStrategy';

export abstract class BaseStrategy<TResult = unknown> implements IStrategy<TResult> {
  abstract name: string;

  async canHandle(_ctx: IExecutionContext): Promise<boolean> {
    return true;
  }

  async score(_ctx: IExecutionContext): Promise<number> {
    return 1;
  }

  abstract execute(ctx: IExecutionContext): Promise<TResult>;
}
