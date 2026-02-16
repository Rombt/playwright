import { Page, APIRequestContext } from 'playwright';
import { ITask } from '../data/entities/ITask';
import { IProduct } from '../data/entities/IProduct';
import { RateLimiter } from '../browser/limiter/RateLimiter';
import { IWorkerResult } from '../data/entities/IResults/IWorkerResult';

export interface ISource<T extends ITask, R = unknown> {
  supports(task: T): boolean;

  execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult>;

  executeHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    product: IProduct,
  ): Promise<IWorkerResult>;

  worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<R[]>;

  workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<R[]>;
}
