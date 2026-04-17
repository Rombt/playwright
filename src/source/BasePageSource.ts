import { Page, APIRequestContext } from 'playwright';

import { ISource } from './ISource';
import { ITask } from '../data/entities/ITask';
import { IProduct } from '../data/entities/IProduct';
import { RateLimiter } from '../browser/limiter/RateLimiter';

import { IWorkerResult } from '../data/entities/IResults/IWorkerResult';
import { IHttpResult } from '../data/entities/IResults/IHttpResult';
import { ILogger } from '../data/logger/types/ILogger';

import { IPageResolver } from './strategies/resolvers/IPageResolver';
import { IImageExtractor } from './strategies/extractors/types/IImageExtractor';
import { IDescriptionExtractor } from './strategies/extractors/types/IDescriptionExtractor';
import { IDataImag } from '../data/entities/IDataImag';
import { IImageItem } from '../data/entities/IImageItem';

export abstract class BasePageSource<T extends ITask> implements ISource<T> {
  // === Стратегии (конфигурируются в наследниках) ===
  protected abstract resolver: IPageResolver;

  protected imageExtractor?: IImageExtractor;
  protected descriptionExtractor?: IDescriptionExtractor;

  // === Обязательный метод (оставляем как есть) ===
  abstract supports(task: T): boolean;

  // =================================================
  // =============== CORE EXECUTION ===================
  // =================================================
  async execute(
    targetUrl: string,
    page: Page,
    options?: {},
    debugMeta?: Record<string, string>,
    sku?: string,
  ): Promise<IWorkerResult> {
    const errors: IWorkerResult['errors'] = [];

    try {
      // 1. Навигация
      await this.resolver.resolve(page, targetUrl, debugMeta);

      // 2. Extract phase
      const extraction = await this.extract(page, debugMeta);

      // 3. Сборка результата
      return this.buildResult(extraction, errors);
    } catch (error: any) {
      errors.push({
        error,
        targetUrl,
      });

      return this.buildResult({}, errors);
    }
  }

  // =================================================
  // =============== EXTRACTION =======================
  // =================================================
  protected async extract(
    page: Page,
    debugMeta?: Record<string, string>,
  ): Promise<{
    images?: string[];
    description?: string | null;
  }> {
    const result: {
      images?: string[];
      description?: string | null;
    } = {};

    if (this.imageExtractor) {
      try {
        result.images = await this.imageExtractor.extract(page, debugMeta);
      } catch (e) {
        // не валим пайплайн
      }
    }

    if (this.descriptionExtractor) {
      try {
        result.description = await this.descriptionExtractor.extract(page, debugMeta);
      } catch (e) {
        // не валим пайплайн
      }
    }

    return result;
  }

  // =================================================
  // =============== RESULT BUILDER ===================
  // =================================================
  protected buildResult(
    extraction: {
      images?: string[];
      description?: string | null;
    },
    errors: IWorkerResult['errors'],
    sku?: string,
  ): IWorkerResult {
    return {
      data: {
        images: extraction.images && sku ? this.mapImages(extraction.images, sku) : undefined,
        html: extraction.description || undefined,
      },
      errors,
    };
  }

  protected mapImages(images: string[], sku: string): IDataImag {
    const items: IImageItem[] = images.map((url, index) => ({
      sku,
      url,
      index,
      idProduct: 0,
    }));

    // 👇 приводим к legacy-формату
    return {
      [sku]: items as unknown as any,
    };
  }

  // =================================================
  // =============== LEGACY (НЕ ТРОГАЕМ) ==============
  // =================================================

  async executeHttpRequest<T = unknown>(
    request: APIRequestContext,
    options: {
      url: string;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
    debugMeta?: Record<string, string>,
  ): Promise<IHttpResult<T>> {
    throw new Error('Not implemented');
  }

  async workerHttpRequest(
    request: APIRequestContext,
    headers: Record<string, string>,
    targetUrl: string,
    limiter: RateLimiter,
    sku: string,
    debugMeta?: Record<string, string>,
    loggerScope?: ILogger,
  ): Promise<IHttpResult<unknown>> {
    throw new Error('Not implemented');
  }

  async worker(
    targetUrl: string,
    page: Page | undefined,
    limiter: RateLimiter,
    getNext?: (() => IProduct | undefined) | IProduct,
    loggerScope?: ILogger,
    sku?: string,
    debugMeta?: Record<string, string>,
  ): Promise<IWorkerResult[]> {
    if (!page) {
      throw new Error('Page is required for BasePageSource');
    }

    const result = await this.execute(targetUrl, page, {}, debugMeta);

    return [result];
  }
}
