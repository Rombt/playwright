import { Page } from 'playwright-core';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { ILogger } from '../../data/logger/types/ILogger';

export interface ExecutionContext {
  page: Page;

  input: {
    url: string;
    sku?: string;
  };

  state: {
    productUrl?: string;
    images?: string[];
    description?: string;
    result?: IWorkerResult;
  };

  actions: {
    click(selector: string): Promise<void>;
    scroll(): Promise<void>;
    wait(ms: number): Promise<void>;
  };

  debug: {
    engine?: string;
    strategies?: Array<{
      step: string;
      strategy: string;
      score: number;
    }>;
  };

  logger: ILogger;
}
