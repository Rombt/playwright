import { Page, APIRequestContext } from 'playwright';
import { ITask } from '../data/entities/ITask';
import { IProduct } from '../data/entities/IProduct';
import { RateLimiter } from '../browser/limiter/RateLimiter';
import { IWorkerResult } from '../data/entities/IResults/IWorkerResult';
import { IHttpResult } from '../data/entities/IResults/IHttpResult';

export interface ISource<T extends ITask> {
  supports(task: T): boolean;

  execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult>;

  executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<IHttpResult<T>>;

  workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<IHttpResult<unknown>[]>;

  worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<IWorkerResult[]>;
}
