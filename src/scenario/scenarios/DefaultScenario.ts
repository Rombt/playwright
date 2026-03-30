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
import { IDataImag, IDataImagItem } from '../../data/entities/IDataImag';
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
import { SharpImageProcessor as ImageProcessor } from '../../processing/ImageProcessor/SharpImageProcessor';

import { HtmlProcessorFactory, Site } from '../../processing/HTMLProcessor';
import { IProductRaw } from '../../processing/HTMLProcessor';

// todo один универсальный тип ProcessResult
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

  private readonly taskPath: string;

  private sources: ISource<ICollectProductPhotosTask>[] = [];
  private resources: IResource[] = [];

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
    this.taskPath = this.config.taskPath;
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
    if (arrTasks.length === 0) {
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
    const allErrors: IWorkerError[] = [];

    const source = this.sources.find((s) => s.supports(task));

    if (!source) {
      loggerScope?.error('Source not found for task', {
        component: 'DefaultScenario',
        method: 'process()',
        action: 'if (!source)',
        task,
      });
      throw new Error('Source not found');
    }

    loggerScope?.debug(`The enter to the process method`, {
      component: 'DefaultScenario',
      method: 'process()',
      stage: 'init',
      data: {
        task: task,
        source: source,
      },
    });

    const limiter = new RateLimiter(10000);
    const allData: IDataImag = {};
    const allProductRaw: IProductRaw[] = [];

    await this.browser.runInContext(async (context) => {
      const products = task.products;

      if (!Array.isArray(products) || products.length === 0) {
        loggerScope?.error('Products are absent', {
          component: 'DefaultScenario',
          method: 'process()',
          stage: 'init',
          data: { task: task },
        });
        throw new Error('Products are absent');
      }

      loggerScope?.debug(`The enter to the browser.runInContext`, {
        component: 'DefaultScenario',
        method: 'process()',
        stage: 'init',
        data: {
          products: products,
        },
      });

      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
      loggerScope?.debug('A unique of unique products is created', {
        component: 'DefaultScenario',
        method: 'process()',
        action: 'const uniqueProducts = Array.from(...)',
        data: {
          uniqueProducts: uniqueProducts,
        },
      });

      const quantityPage = Math.min(uniqueProducts.length, this.maxPage);

      const pool = new PagePool(context, quantityPage);
      this.registerResource(pool);
      let page: Page;

      const processProduct = async (product: IProduct): Promise<TaskResult> => {
        if (!task.metadata.target_website) {
          loggerScope?.error('Task metadata does not contain target_website!!', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'if (!task.metadata.target_website)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,
            },
          });

          throw new Error('Error!! Task metadata does not contain target_website!!');
        }

        try {
          page = await pool.acquire();

          loggerScope?.debug('Beginning processing of product', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'const processProduct = async (product: IProduct)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,

              limiter: limiter,
            },
          });

          const result = await this.withRetry(
            () => source.worker(task.metadata.target_website!, page, limiter, product, loggerScope),
            {
              maxRetries: this.maxRetries,
              isRetryable,
            },
            limiter,
            loggerScope,
          );

          loggerScope?.debug('Product processing finished', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'await this.withRetry(...)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,

              limiter: limiter,
              result: result,
            },
          });

          for (const r of result) {
            for (const [sku, images] of Object.entries(r.data.images ?? {})) {
              if (!allData[sku]) {
                const arr = [] as unknown as IDataImagItem;
                arr.idProduct = images.idProduct;
                allData[sku] = arr;
              }

              allData[sku].push(...images);
            }

            if (r.data.html) {
              const processor = new HtmlProcessorFactory().create(task.brand_name.toLowerCase());

              console.log('processor = ', processor);
              const rawContent = processor.process(r.data.html);

              if (Array.isArray(rawContent)) {
                // здесь в будущем обработка атрибутов товара
              } else {
                allProductRaw.push({
                  sku: product.sku,
                  id: product.id_product,
                  content: rawContent,
                });

                //todo добавить возможность записывать в json файл кусками вместо того что бы держать в памяти
              }
            }
          }

          loggerScope?.debug('Image data aggregation finished', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'for (const r of result)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,
              limiter: limiter,
              result: result,
              status: 'success',
              allDataCount: allData.length,
              allData: allData,
              allProductRaw: allProductRaw,
            },
          });

          // pool.release(page);

          return { status: 'success' };
        } catch (err) {
          const error = err as IWorkerError;

          const errorStatus: TaskResult = isRetryable(error)
            ? { status: 'retry', product, error }
            : { status: 'fatal', product, error };

          loggerScope?.error('Error during worker execution with retry mechanism.', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'for (const r of result)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,
              status: errorStatus.status,
              errorName: error instanceof Error ? error.name : undefined,
              errorMessage: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
          });

          return errorStatus;
        } finally {
          if (page) {
            pool.release(page);
          }
        }
      };

      let attempt = 1;
      let currentBatch = uniqueProducts;

      while (currentBatch.length && attempt <= this.maxRetries) {
        loggerScope?.debug('Entering retry loop for current batch', {
          component: 'DefaultScenario',
          method: 'process()',
          action: 'while (currentBatch.length && attempt <= this.maxRetries) {...',
          data: {
            attempt: attempt,
            maxRetries: this.maxRetries,
            currentBatchLength: currentBatch.length,
            currentBatch: currentBatch,
          },
        });

        const results = (await Promise.allSettled(currentBatch.map(processProduct)))
          .filter((r): r is PromiseFulfilledResult<TaskResult> => r.status === 'fulfilled')
          .map((r) => r.value);

        loggerScope?.debug('Current batch processing finished', {
          component: 'DefaultScenario',
          method: 'process()',
          action: 'results = (await Promise.allSettled(currentBatch.map(processProduct)))',
          data: {
            attempt: attempt,
            maxRetries: this.maxRetries,
            currentBatchLength: currentBatch.length,
            currentBatch: currentBatch,
            results: results,
          },
        });

        const retryResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
        );

        loggerScope?.debug('Filtered retryable tasks from current batch results', {
          component: 'DefaultScenario',
          method: 'process()',
          action: "(r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry')",
          data: {
            attempt: attempt,
            maxRetries: this.maxRetries,
            currentBatchLength: currentBatch.length,
            currentBatch: currentBatch,
            retryResults: retryResults,
            results: results,
          },
        });

        const fatalResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal',
        );

        loggerScope?.debug('Filtered fatal tasks from current batch results', {
          component: 'DefaultScenario',
          method: 'process()',
          action: "(r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal')",
          data: {
            attempt: attempt,
            maxRetries: this.maxRetries,
            currentBatchLength: currentBatch.length,
            currentBatch: currentBatch,
            fatalResults: fatalResults,
            results: results,
          },
        });

        fatalResults.forEach((r) =>
          allErrors.push({
            error: r.error,
            targetUrl: task.metadata.target_website ?? undefined,
          }),
        );

        currentBatch = retryResults.map((r) => r.product);

        loggerScope?.debug('Next batch prepared from retryable tasks', {
          component: 'DefaultScenario',
          method: 'process()',
          action: 'currentBatch = retryResults.map((r) => r.product)',
          data: {
            attempt: attempt,
            maxRetries: this.maxRetries,
            currentBatchLength: currentBatch.length,
            currentBatch: currentBatch,
          },
        });

        attempt++;
      }

      const normalized = normalizeAllData(allData);

      loggerScope?.debug('All data normalized', {
        component: 'DefaultScenario',
        method: 'process()',
        action: 'normalized = normalizeAllData(allData)',
        data: {
          normalized: normalized,
        },
      });

      allErrors.push(
        ...(await this.downloadImages(normalized, task, context, limiter, loggerScope)),
      );
    });

    await this.storage.saveJson(allProductRaw, {
      filename: `${task.brand_name}_products_raw.json`,
      targetDir: '',
    });

    await this.storage.saveJson(allErrors, {
      filename: `${task.brand_name}_unprocessed-products.json`,
      targetDir: '',
    });
  }

  private async downloadImages(
    urlsBySku: Record<string, string[]>,
    task: ICollectProductPhotosTask,
    context: BrowserContext,
    limiter: RateLimiter,
    loggerScope?: ILogger,
  ): Promise<IWorkerError[]> {
    const queue: Array<{ sku: string; url: string; index: number; idProduct?: number }> = [];
    const allErrors: IWorkerError[] = [];

    const ImgPool = new PagePool(context, this.maxPage);

    loggerScope?.debug('Starting image download for current task', {
      component: 'DefaultScenario',
      method: 'downloadImages()',
      action: 'async downloadImages(...)',
      data: {
        urlsBySku: urlsBySku,
        task: task,
        pool: ImgPool,
        limiter: limiter,
      },
    });

    for (const [sku, urls] of Object.entries(urlsBySku) as [string, IDataImagItem][]) {
      urls.forEach((url, i) => queue.push({ sku, url, index: i + 1, idProduct: urls.idProduct }));
    }

    const processImage = async (item: IImageItem): Promise<ImageResult> => {
      loggerScope?.debug(`Started processing an image item ${item.index}`, {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: 'processImage = async (item: IImageItem)',
        data: {
          item: item,
        },
      });

      let page: Page | undefined;

      try {
        page = await ImgPool.acquire();

        const { buffer, ext } = await this.withRetry(
          () =>
            limiter.schedule(async () => {
              loggerScope?.debug('Starting scheduled action execution', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'limiter.schedule(async () => {',
                data: {
                  item: item,

                  maxRetries: this.maxRetries,
                },
              });
              return await this.browser.downloadWithFallback(item.url, page!, context, loggerScope);
            }),
          {
            maxRetries: this.maxRetries,
            isRetryable,
          },
          limiter,
          loggerScope,
        );

        loggerScope?.debug(
          `Image download via withRetry completed  ${task.brand_name}/${item.sku}/${item.index}${ext}`,
          {
            component: 'DefaultScenario',
            method: 'downloadImages()',
            action: 'await this.withRetry(...)',
            data: {
              item: item,
              maxRetries: this.maxRetries,
              isRetryable: this.maxRetries,
              ext: ext,
            },
          },
        );

        let _buf = buffer;
        let _ext = ext;

        if (this.config.convertToJpg) {
          const imageProcessor: ImageProcessor = new ImageProcessor(this.storage);
          _buf = await imageProcessor.convertBufferToJpg(buffer);
          _ext = '.jpg';
        }

        const fileName = `${item.idProduct}_${item.sku}_${item.index}${_ext}`;
        await this.storage.save({
          filename: fileName,
          buffer: _buf,
          targetDir: '',
        });

        loggerScope?.debug(`Image saved: ${fileName}`, {
          component: 'DefaultScenario',
          method: 'downloadImages()',
          action: 'this.storage.save({...})',
          data: {
            item: item,
            maxRetries: this.maxRetries,
            isRetryable: this.maxRetries,
            status: 'success',
          },
        });

        return { status: 'success' };
      } catch (err) {
        const error = err as IWorkerError;

        const errorStatus: ImageResult = isRetryable(error)
          ? { status: 'retry', item, error }
          : { status: 'fatal', item, error };

        loggerScope?.error(`Image download or save failed for SKU ${item.sku}`, {
          component: 'DefaultScenario',
          method: 'downloadImages()',
          action: 'this.storage.save({...})',
          data: {
            item: item,
            maxRetries: this.maxRetries,
            isRetryable: isRetryable(error),
            status: errorStatus.status,
            error: error,
            err: err,
          },
        });

        return errorStatus;
      } finally {
        loggerScope?.debug('Releasing page back to pool', {
          component: 'DefaultScenario',
          method: 'downloadImages()',
          action: 'processImage = async (item: IImageItem)',
          data: {
            item: item,
          },
        });

        if (page) {
          ImgPool.release(page);
        }
      }
    };

    let attempt = 1;
    let currentBatch = queue;

    loggerScope?.debug('Before retry loop for current batch initiated', {
      component: 'DefaultScenario',
      method: 'downloadImages()',
      action: '',
      data: {
        attempt: attempt,
        maxRetries: this.maxRetries,
        currentBatchLength: currentBatch.length,
        currentBatch: currentBatch,
      },
    });

    while (currentBatch.length && attempt <= this.maxRetries) {
      await limiter.sleep(1000, 5000);

      loggerScope?.debug('Retry loop initiated for current batch', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: 'while (currentBatch.length && attempt <= this.maxRetries)',
        data: {
          attempt: attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch: currentBatch,
        },
      });

      const results = (
        await Promise.allSettled(currentBatch.map((item) => processImage(item as IImageItem)))
      )
        .filter((r): r is PromiseFulfilledResult<ImageResult> => r.status === 'fulfilled')
        .map((r) => r.value);

      loggerScope?.debug('Current batch processing finished', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: 'results = (await Promise.allSettled(currentBatch.map(processImage)))',
        data: {
          attempt: attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch: currentBatch,
          results: results,
        },
      });

      const retryResults = results.filter(
        (r): r is Extract<ImageResult, { status: 'retry' }> => r.status === 'retry',
      );

      loggerScope?.debug('Filtered retryable tasks from current batch results', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: "(r): r is Extract<ImageResult, { status: 'retry' }> => r.status === 'retry',))",
        data: {
          attempt: attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch: currentBatch,
          retryResults: retryResults,
          results: results,
        },
      });

      const fatalResults = results.filter(
        (r): r is Extract<ImageResult, { status: 'fatal' }> => r.status === 'fatal',
      );

      loggerScope?.debug('Filtered fatal tasks from current batch results', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: "(r): r is Extract<ImageResult, { status: 'fatal' }> => r.status === 'fatal',)",
        data: {
          attempt: attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch: currentBatch,
          fatalResults: fatalResults,
          results: results,
        },
      });

      fatalResults.forEach((r) =>
        allErrors.push({
          error: r.error,
          targetUrl: r.item.url,
        }),
      );

      currentBatch = retryResults.map((r) => r.item);

      loggerScope?.debug('Next batch prepared from retryable tasks', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: 'currentBatch = retryResults.map((r) => r.item)',
        data: {
          attempt: attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch: currentBatch,
        },
      });

      attempt++;
    }

    return allErrors;
  }

  private async withRetry<T>(
    action: () => Promise<T>,
    options: {
      maxRetries: number;
      isRetryable: (error: IWorkerError) => boolean;
    },
    limiter: RateLimiter,
    loggerScope?: ILogger,
  ): Promise<T> {
    let attempt = 1;

    while (true) {
      try {
        return await action();
      } catch (err) {
        const workerError = this.normalizeError(err);

        loggerScope?.error('Error in withRetry', {
          attempt,
          maxRetries: options.maxRetries,
          message:
            workerError.error instanceof Error
              ? workerError.error.message
              : String(workerError.error),
          isRetryable: options.isRetryable(workerError),
        });

        // Проверка retryable
        if (!options.isRetryable(workerError)) {
          loggerScope?.debug('Error is NOT retryable → throwing');
          throw workerError;
        }

        // Проверка лимита попыток
        if (attempt >= options.maxRetries) {
          loggerScope?.debug('Max retries reached → throwing');
          throw workerError;
        }

        // Retry
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
    const sources: ISource<ICollectProductPhotosTask>[] = [];

    const walk = async (dir: string) => {
      const files = await fs.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.resolve(dir, file.name);

        if (file.isDirectory()) {
          await walk(fullPath);
          continue;
        }

        if (!file.name.endsWith('.js')) continue;

        const sourceModule = require(fullPath);
        const SourceClass = sourceModule.default ?? sourceModule;

        sources.push(new SourceClass());
      }
    };

    await walk(this.sourcesFolder);

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

  //todo перенести в helpers
  private normalizeError(err: unknown): { error: Error; meta?: any } {
    if (err instanceof Error) {
      return { error: err };
    }

    if (typeof err === 'object' && err !== null) {
      const obj = err as any;

      const message =
        typeof obj.message === 'string'
          ? obj.message
          : typeof obj.error?.message === 'string'
          ? obj.error.message
          : typeof obj.error?.name === 'string'
          ? obj.error.name
          : 'Unknown error';

      return {
        error: new Error(message),
        meta: obj,
      };
    }

    return { error: new Error(String(err)) };
  }
}
