import { BrowserContext, Page } from 'playwright-core';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IScenario } from '../IScenario';
import { ISource } from '../../source/ISource';
import { IStorage } from '../../storage/IStorage';
import { IBrowser } from '../../browser/IBrowser';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IDownloadedFile } from '../../browser/IDownloadedFile';
import { IDataImag } from '../../data/entities/IDataImag';
import { ICollectProductPhotosBatch } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosBatch';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IResource } from '../../browser/IResource';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { PagePool } from '../../browser/pool/PagePool';
import { IProduct } from '../../data/entities/IProduct';

import { IImageItem } from '../../data/entities/IImageItem';
import { IImageError } from '../../data/entities/IErrors/IImageError';
import { AppConfig } from '../../data/config/appConfig';

import { normalizeAllData, isRetryable, waitBeforeRetry } from '../../common/helpers';

import { Logger } from '../../data/logger/Logger';
import { IScopedLogger } from '../../data/logger/types/IScopedLogger';
import { ILogger } from '../../data/logger/types/ILogger';

type TaskResult =
  | { status: 'success' }
  | { status: 'retry'; product: IProduct; error: IWorkerError }
  | { status: 'fatal'; product: IProduct; error: IWorkerError };

type ImageResult =
  | { status: 'success' }
  | { status: 'retry'; item: IImageItem; error: IWorkerError }
  | { status: 'fatal'; item: IImageItem; error: IWorkerError };

export class DefaultScenario<Browser, Context extends BrowserContext>
  implements IScenario<Browser, Context>
{
  private readonly config: AppConfig;
  private readonly maxRetries: number;
  private readonly maxPage: number;
  private readonly maxTask: number;
  private readonly sourcesFolder: string;
  private readonly logger: Logger;

  private readonly taskPath: string = 'src/data/tasks/all_brands_for_test.json';
  // private readonly taskPath: string = 'src/data/tasks/puma_for_tests.json';
  // private readonly taskPath: string = 'src/data/tasks/m-tac_for_tests.json';
  // private readonly taskPath: string = 'src/data/tasks/new_balance_tests.json';
  // private readonly taskPath: string = 'src/data/tasks/nike_tests.json';
  // private readonly taskPath: string = 'src/data/tasks/joma_tests.json';
  // private readonly taskPath: string = 'src/data/tasks/adidas_tests.json';
  // private readonly taskPath: string = 'src/data/tasks/ganzo_tests.json';

  private sources: ISource<ICollectProductPhotosTask>[] = [];
  private resources: IResource[] = [];
  private allErrors: IWorkerError[] = [];

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: IStorage,
  ) {
    this.config = AppConfig.getInstance();
    this.logger = Logger.getInstance();

    this.maxRetries = this.config.asyncRetry.maxRetries;
    this.maxPage = this.config.asyncPages.maxPage;
    this.maxTask = this.config.asyncTasks.maxTask;
    this.sourcesFolder = this.config.sourcesFolder;
  }

  async run(brands?: string[]): Promise<void> {
    try {
      const tasks = await this.load(brands);

      this.logger.debug(`DefaultScenario started`, {
        component: 'DefaultScenario',
        method: 'run()',
        action: 'await this.load(brands)',
        data: {
          brands: brands,
          totalTasks: tasks.length,
          tasks: tasks,
        },
      });

      await this.prepare();

      await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
    } catch (error) {
      this.logger.error(`DefaultScenario run() error`, {
        component: 'DefaultScenario',
        method: 'run',
        data: {
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    } finally {
      this.logger.debug(`DefaultScenario completed`, {
        component: 'DefaultScenario',
        method: 'run()',
        action: '} finally {',
        data: {
          brands: brands,
        },
      });

      await this.finalize();
    }
  }

  private async runWithWorkerPool(
    tasks: ICollectProductPhotosTask[],
    handler: (task: ICollectProductPhotosTask, loggerScope?: ILogger) => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = index++;

        this.logger.debug(`Worker № ${currentIndex} is started`, {
          component: 'DefaultScenario',
          method: 'runWithWorkerPool',
          action: 'while (true)',
          stage: 'start',
          data: {
            currentIndex: currentIndex,
          },
        });

        if (currentIndex >= tasks.length) {
          this.logger.debug('All tasks are completed', {
            component: 'DefaultScenario',
            method: 'runWithWorkerPool',
            action: 'if (currentIndex >= tasks.length) {...}',
            data: {
              currentIndex: currentIndex,
              tasksLength: tasks.length,
            },
          });

          break;
        }

        const task = tasks[currentIndex];
        const loggerScope = this.logger.withContext(`Worker №${currentIndex} ${task.brand_name}`);

        loggerScope.debug('Received a new task', {
          component: 'DefaultScenario',
          method: 'runWithWorkerPool',
          action: 'const task = tasks[currentIndex];',
          data: {
            currentIndex: currentIndex,
            task: task,
          },
        });

        try {
          loggerScope.debug('Gave task it for execution ', {
            component: 'DefaultScenario',
            method: 'runWithWorkerPool',
            action: 'try {...}',
            data: {
              currentIndex: currentIndex,
              task: task,
            },
          });

          await handler(task, loggerScope);
        } catch (error) {
          loggerScope.error(`Worker task error`, {
            component: 'DefaultScenario',
            method: 'runWithWorkerPool',
            data: {
              task,
              errorName: error instanceof Error ? error.name : undefined,
              errorMessage: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
          });
        }
      }
    };

    const workers = Array.from({ length: this.maxTask }, () => worker());

    await Promise.allSettled(workers);
    this.logger.info('All task groups have been processed', {
      component: 'DefaultScenario',
      method: 'runWithWorkerPool',
      action: 'workers = Array.from({ length: this.maxTask }, () => worker()',
      data: {
        totalTasks: tasks.length,
      },
    });
  }

  async load(brands?: string[]): Promise<ICollectProductPhotosTask[]> {
    const filePath = path.resolve(process.cwd(), this.taskPath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ICollectProductPhotosBatch = JSON.parse(raw);

    const arrTasks: ICollectProductPhotosTask[] = Object.values(data.task);
    if (arrTasks.length > 0) {
      this.logger.error('Tasks array is invalid or corrupted', {
        component: 'DefaultScenario',
        method: 'load()',
        data: {
          arrTasks: arrTasks,
        },
      });

      throw new Error('Tasks array is invalid or corrupted');
    }

    if (!brands?.length) return arrTasks;

    return arrTasks.filter((task) => brands.includes(task.brand_name));
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(task: ICollectProductPhotosTask, loggerScope?: ILogger): Promise<void> {
    const source = this.sources.find((s) => s.supports(task));

    if (!source) {
      loggerScope?.error('Source not found for task', {
        component: 'DefaultScenario',
        method: 'process',
        action: 'if (!source)',
        task,
      });
      throw new Error('Source not found');
    }

    loggerScope?.debug(`The enter to the process method`, {
      component: 'DefaultScenario',
      method: 'process',
      stage: 'init',
      data: {
        task: task,
        source: source,
      },
    });

    const limiter = new RateLimiter(5000);
    const allData: IDataImag = {};

    await this.browser.runInContext(async (context) => {
      const products = task.products;

      if (!Array.isArray(products) || products.length === 0) {
        loggerScope?.error('Products are absent', {
          component: 'DefaultScenario',
          method: 'process',
          stage: 'init',
          data: { task: task },
        });
        throw new Error('Products are absent');
      }

      loggerScope?.debug(`The enter to the browser.runInContext`, {
        component: 'DefaultScenario',
        method: 'process',
        stage: 'init',
        data: {
          products: products,
        },
      });

      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
      loggerScope?.debug('A unique of unique products is created', {
        component: 'DefaultScenario',
        method: 'process',
        action: 'const uniqueProducts = Array.from(...)',
        data: {
          uniqueProducts: uniqueProducts,
        },
      });

      const quantityPage = Math.min(uniqueProducts.length, this.maxPage);

      const pool = new PagePool(context, quantityPage);
      this.registerResource(pool);

      const processProduct = async (product: IProduct): Promise<TaskResult> => {
        try {
          const page = await pool.acquire();

          const result = await this.withRetry(
            () => source.worker(task.metadata.target_website!, page, limiter, () => product),
            {
              maxRetries: this.maxRetries,
              isRetryable,
            },
            loggerScope,
          );

          for (const r of result) {
            for (const [sku, images] of Object.entries(r.data)) {
              allData[sku] ??= [];
              allData[sku].push(...images);
            }
          }

          pool.release(page);

          return { status: 'success' };
        } catch (err) {
          const error = err as IWorkerError;

          return isRetryable(error)
            ? { status: 'retry', product, error }
            : { status: 'fatal', product, error };
        }
      };

      let attempt = 1;
      let currentBatch = uniqueProducts;

      while (currentBatch.length && attempt <= this.maxRetries) {
        await limiter.sleep(1000, 5000);

        const results = await Promise.all(currentBatch.map(processProduct));

        const retryResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
        );

        const fatalResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal',
        );

        fatalResults.forEach((r) =>
          this.allErrors.push({
            error: r.error,
            targetUrl: task.metadata.target_website ?? undefined,
          }),
        );

        currentBatch = retryResults.map((r) => r.product);

        attempt++;
      }

      const normalized = normalizeAllData(allData);

      await this.downloadImages(normalized, task, pool, limiter, loggerScope);
    });

    await this.storage.saveJson(this.allErrors, {
      filename: `${task.brand_name}_unprocessed-products.json`,
      targetDir: task.brand_name,
    });
  }

  private async downloadImages(
    urlsBySku: Record<string, string[]>,
    task: ICollectProductPhotosTask,
    pool: PagePool,
    limiter: RateLimiter,
    loggerScope?: ILogger,
  ): Promise<void> {
    const queue: IImageItem[] = [];

    for (const [sku, urls] of Object.entries(urlsBySku)) {
      urls.forEach((url, i) => queue.push({ sku, url, index: i + 1 }));
    }

    const processImage = async (item: IImageItem): Promise<ImageResult> => {
      const page = await pool.acquire();
      try {
        const { buffer, ext } = await this.withRetry(
          () => limiter.schedule(() => this.browser.download(page, item.url)),
          {
            maxRetries: this.maxRetries,
            isRetryable,
          },
          loggerScope,
        );

        await this.storage.save({
          filename: `${task.brand_name}_${item.sku}_${item.index}${ext}`,
          buffer,
          targetDir: path.join(task.brand_name, item.sku),
        });

        return { status: 'success' };
      } catch (err) {
        const error = err as IWorkerError;

        return isRetryable(error)
          ? { status: 'retry', item, error }
          : { status: 'fatal', item, error };
      }
    };

    let attempt = 1;
    let currentBatch = queue;

    while (currentBatch.length && attempt <= this.maxRetries) {
      await limiter.sleep(1000, 5000);

      const results = await Promise.all(currentBatch.map(processImage));

      const retryResults = results.filter(
        (r): r is Extract<ImageResult, { status: 'retry' }> => r.status === 'retry',
      );

      const fatalResults = results.filter(
        (r): r is Extract<ImageResult, { status: 'fatal' }> => r.status === 'fatal',
      );

      fatalResults.forEach((r) =>
        this.allErrors.push({
          error: r.error,
          targetUrl: r.item.url,
        }),
      );

      currentBatch = retryResults.map((r) => r.item);

      attempt++;
    }
  }

  private async withRetry<T>(
    action: () => Promise<T>,
    options: {
      maxRetries: number;
      isRetryable: (error: IWorkerError) => boolean;
    },
    loggerScope?: ILogger,
  ): Promise<T> {
    let attempt = 1;

    while (true) {
      try {
        return await action();
      } catch (err) {
        if (attempt >= options.maxRetries || !options.isRetryable(err as IWorkerError)) {
          throw err;
        }

        await waitBeforeRetry(attempt);
        attempt++;
      }
    }
  }

  async handleError(error: IWorkerError, attempt: number = 1): Promise<void> {
    if (attempt < this.maxRetries && isRetryable(error)) {
      await waitBeforeRetry(attempt);
      return this.handleError(error, attempt + 1);
    }

    throw error;
  }

  async loadSources(): Promise<ISource<ICollectProductPhotosTask>[]> {
    const files = await fs.readdir(this.sourcesFolder);
    const sources: ISource<ICollectProductPhotosTask>[] = [];

    for (const file of files) {
      if (!file.endsWith('.js')) continue;

      const fullPath = path.resolve(this.sourcesFolder, file);

      const sourceModule = require(fullPath);
      const SourceClass = sourceModule.default ?? sourceModule;

      sources.push(new SourceClass());
    }

    return sources;
  }

  registerResource(res: IResource): void {
    this.resources.push(res);
  }

  async finalize(): Promise<void> {
    for (const res of this.resources) {
      try {
        await res.close();
      } catch (err) {
        console.warn(err);
      }
    }

    this.browser.close();
  }
}
