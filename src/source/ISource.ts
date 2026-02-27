import { Page, APIRequestContext } from 'playwright';
import { ITask } from '../data/entities/ITask';
import { IProduct } from '../data/entities/IProduct';
import { RateLimiter } from '../browser/limiter/RateLimiter';
import { IWorkerResult } from '../data/entities/IResults/IWorkerResult';
import { IHttpResult } from '../data/entities/IResults/IHttpResult';
import { ILogger } from '../data/logger/types/ILogger';

export interface ISource<T extends ITask, THttpResponse = unknown> {
  supports(task: T): boolean;

  execute(
    targetUrl: string,
    page: Page,
    options?: {},
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult>;

  executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
    debugMeta?: Record<string, string>,
  ): Promise<IHttpResult<T>>;

  workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    sku: string,
    debugMeta?: Record<string, string>,
    loggerScope?: ILogger,
  ): Promise<IHttpResult<THttpResponse>>;

  worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext?: () => IProduct | undefined,
    sku?: string,
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult[]>;
}
