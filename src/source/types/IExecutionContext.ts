import { Page } from 'playwright';
import { ITask } from '../../data/entities/ITask';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IProduct } from '../../data/entities/IProduct';
import { IScopedLogger } from '../../data/logger/types/IScopedLogger';

import { IStepFactory } from './IStepFactory';
import { IStrategyDebugEntry } from './IStrategyDebugEntry';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { IStepConstructor, StepParamsMap } from './IStepConstructor';
import { IStrategyResolver } from '../types/IStrategyResolver';

export interface IExecutionContext<TTask extends ITask = ITask> {
  // core
  page: Page;
  logger: IScopedLogger;

  // input
  task: TTask;

  input: {
    url?: string;
    sku?: string;
    normalizedSku?: string;

    product?: IProduct;
  };

  // mutable state
  state: {
    productUrl?: string;
    images?: string[];
    description?: string;
    html?: string;

    strategy?: Record<string, unknown>;

    [key: string]: unknown;
  };

  // infra
  stepFactory: IStepFactory;
  stepParams?: StepParamsMap;
  strategyResolver: IStrategyResolver;

  // errors (вместо diagnostics)
  errors: IWorkerError[];

  // explainability
  debug: {
    strategies: IStrategyDebugEntry[];
  };

  // flow control
  control: {
    stop?: boolean;
    skipNext?: boolean;
  };
}
