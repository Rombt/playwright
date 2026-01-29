import { ITask } from '../data/entities/ITask';
import { Page } from 'playwright';
import { Product } from '../data/entities/Product';
import { RateLimiter } from '../browser/limiter/RateLimiter';
import { IWorkerResult } from '../data/entities/IResults/IWorkerResult';

export interface ISource<T extends ITask, R = unknown> {
  supports(task: T): boolean;

  execute(targetUrl: string, page: Page, product: Product): Promise<IWorkerResult>;

  worker(
    targetUrl: string,
    page: Page,
    limiter: RateLimiter,
    getNext: () => Product | undefined,
  ): Promise<unknown[]>;
}
