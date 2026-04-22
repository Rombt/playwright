import { IExecutionContext } from './IExecutionContext';

export interface IErrorHandler {
  capture(
    ctx: IExecutionContext,
    error: unknown,
    meta?: {
      step?: string;
      strategy?: string;
      targetUrl?: string;
    },
  ): void;
}
