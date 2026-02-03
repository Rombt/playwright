import { ITask } from '../data/entities/ITask';
import { Page } from 'playwright';
import { IProduct } from '../data/entities/IProduct';
import { RateLimiter } from '../browser/limiter/RateLimiter';
import { IWorkerResult } from '../data/entities/IResults/IWorkerResult';

export interface ISource<T extends ITask> {
  supports(task: T): boolean;

  execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult>;

  worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => IProduct | undefined,
  ): Promise<unknown[]>;
}
