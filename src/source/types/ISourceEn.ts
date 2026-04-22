import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { ExecutionContext } from '../types/ExecutionContext';
import { Page, APIRequestContext } from 'playwright';
import { ITask } from '../../data/entities/ITask';
import { IProduct } from '../../data/entities/IProduct';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { IHttpResult } from '../../data/entities/IResults/IHttpResult';
import { ILogger } from '../../data/logger/types/ILogger';

export interface ISourceEn<TTask = unknown> {
  supports(task: TTask): boolean;

  execute(ctx: ExecutionContext): Promise<IWorkerResult>;
}
