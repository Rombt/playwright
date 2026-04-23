import { BrowserContext, Page } from 'playwright-core';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IScenario } from '../IScenario';
import { ISource } from '../../source/types/ISourceOld';
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
import { UnprocessedCollector } from '../../data/collectors/UnprocessedCollector';
import { BRAND_ALIASES } from '../../data/entities/brand_aliases';

/* new imports */

import {
  ISourceDependencies,
  FlowRunner,
  DefaultStrategyResolver,
  ActionsFactory,
  ISourceDefinition,
} from '../../source';

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
  private readonly maxPageDownloadImg: number;
  private readonly maxTask: number;
  private readonly sourcesFolder: string;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;

  private readonly taskPath: string;

  private sources: ISource<ICollectProductPhotosTask>[] = [];
  private resources: IResource[] = [];

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: IStorage,
    private mode: string,
  ) {
    this.config = AppConfig.getInstance();
    this.logger = Logger.getInstance();
    this.limiter = new RateLimiter(10000);

    this.maxRetries = this.config.asyncRetry.maxRetries;
    this.maxPage = this.config.asyncPages.maxPage;
    this.maxPageDownloadImg = this.config.asyncPages.maxPageDownloadImg;
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

      this.logger.debug(`after await this.runWithWorkerPool(tasks, (task, loggerScope)`, {
        component: 'DefaultScenario',
        method: 'run()',
        action: '',
        data: {
          brands: brands,
          totalTasks: tasks.length,
          tasks: tasks,
        },
      });

      await this.retryUnprocessed(brands);
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

  private async retryUnprocessed(brands?: string[]): Promise<void> {
    this.logger.debug('Enter retryUnprocessed', {
      component: 'DefaultScenario',
      method: 'retryUnprocessed',
      data: { brands },
    });

    const collector = new UnprocessedCollector();
    const maxAttempts = this.config.asyncRetry.maxAttempts;

    let attempt = 0;

    while (attempt < maxAttempts) {
      const currentCount = collector.countTotal();

      // всё обработано
      if (currentCount === 0) {
        this.logger.debug('No unprocessed products left', {
          component: 'DefaultScenario',
          method: 'retryUnprocessed',
          data: { attempt },
        });
        break;
      }

      this.logger.debug('Retry attempt started', {
        component: 'DefaultScenario',
        method: 'retryUnprocessed',
        data: {
          attempt: attempt + 1,
          currentCount,
        },
      });

      let tasks = collector.getPhotoCollectionTasks(this.mode);

      if (brands?.length) {
        tasks = tasks.filter((t) => brands.includes(t.brand_name));
      }

      if (!tasks.length) {
        this.logger.warn('No tasks generated, stopping retry', {
          component: 'DefaultScenario',
          method: 'retryUnprocessed',
        });
        break;
      }

      await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));

      const newCount = collector.countTotal();

      if (newCount >= currentCount) {
        this.logger.warn('No progress in retry, stopping', {
          component: 'DefaultScenario',
          method: 'retryUnprocessed',
          data: { attempt, currentCount, newCount },
        });
        break;
      }

      attempt++;

      await this.limiter.sleepNormal(
        this.config.asyncRetry.baseDelay,
        this.config.asyncRetry.maxDelay,
      );
    }

    this.logger.debug('Retry finished', {
      component: 'DefaultScenario',
      method: 'retryUnprocessed',
      data: {
        attemptsDone: attempt,
      },
    });
  }

  private async runWithWorkerPool(
    tasks: ICollectProductPhotosTask[],
    handler: (task: ICollectProductPhotosTask, loggerScope?: ILogger) => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const getNextTask = (): { task: ICollectProductPhotosTask; index: number } | null => {
      if (index >= tasks.length) return null;

      const currentIndex = index;
      index++;

      return {
        task: tasks[currentIndex],
        index: currentIndex,
      };
    };

    const worker = async (workerId: number) => {
      this.logger.debug(`Worker ${workerId} started`);

      while (true) {
        const next = getNextTask();

        if (!next) {
          this.logger.debug(`Worker ${workerId} finished`);
          return;
        }

        const { task, index: currentIndex } = next;

        const loggerScope = this.logger.withContext(
          `Worker ${workerId} Task#${currentIndex} ${task.brand_name}`,
        );

        loggerScope.debug('Task received');

        try {
          await handler(task, loggerScope);

          loggerScope.debug('Task completed');
        } catch (error) {
          loggerScope.error('Worker task error', {
            task,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
    };

    const workers = Array.from({ length: this.maxTask }, (_, i) => worker(i));

    await Promise.allSettled(workers);

    this.logger.info('All task groups have been processed', {
      component: 'DefaultScenario',
      method: 'runWithWorkerPool',
      data: {
        totalTasks: tasks.length,
      },
    });
  }

  async load(brands?: string[]): Promise<ICollectProductPhotosTask[]> {
    return this.loadTasks(brands);
  }

  private async loadTasks(brands?: string[]): Promise<ICollectProductPhotosTask[]> {
    const filePath = path.resolve(process.cwd(), this.taskPath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ICollectProductPhotosBatch = JSON.parse(raw);

    const arrTasks: ICollectProductPhotosTask[] = Object.values(data.task);

    if (arrTasks.length === 0) {
      this.logger.error('Tasks array is invalid or corrupted', {
        component: 'DefaultScenario',
        method: 'loadTasks()',
        data: { arrTasks },
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

    const allData: IDataImag = {};
    const allProductRaw: IProductRaw[] = [];

    // await this.browser.runInContext(async (context) => {
    await this.browser.runInContextByChromium(async (context) => {
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

        let page: Page | undefined;
        try {
          page = await pool.acquire();

          loggerScope?.debug('Beginning processing of product', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'const processProduct = async (product: IProduct)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,

              limiter: this.limiter,
            },
          });

          //!!!!!!!!!!!!!!!!! 1111
          const result = await this.withRetry(
            () =>
              source.worker(
                task.metadata.target_website!,
                page,
                this.limiter,
                product,
                loggerScope,
              ),
            {
              maxRetries: this.maxRetries,
              isRetryable,
            },
            this.limiter,
            loggerScope,
          );

          loggerScope?.debug('Product processing finished', {
            component: 'DefaultScenario',
            method: 'process()',
            action: 'await this.withRetry(...)',
            data: {
              product: product,
              targetWebsite: task.metadata.target_website,

              limiter: this.limiter,
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
              const brandKey = this.resolveBrandName(task.brand_name);
              loggerScope?.debug('Start processing description of product', {
                component: 'DefaultScenario',
                method: 'process()',
                action: 'brandKey = this.resolveBrandName(task.brand_name)',
                data: {
                  product: product,
                  taskBrandName: task.brand_name,
                  brandKey: brandKey,
                },
              });

              const processor = new HtmlProcessorFactory().create(brandKey.toLowerCase());

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
              limiter: this.limiter,
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

      while (currentBatch.length > 0 && attempt < this.maxRetries) {
        loggerScope?.debug('Entering retry loop for current batch', {
          attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
        });

        const settled = await Promise.allSettled(currentBatch.map(processProduct));

        // 👉 разделяем результаты
        const fulfilled = settled.filter(
          (r): r is PromiseFulfilledResult<TaskResult> => r.status === 'fulfilled',
        );

        const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

        // 👉 логируем ошибки (ВАЖНО!)
        if (rejected.length) {
          loggerScope?.error('Rejected promises detected', {
            rejected,
          });

          rejected.forEach((r) => {
            allErrors.push({
              error: r.reason,
              targetUrl: task.metadata.target_website ?? undefined,
            });
          });
        }

        const results = fulfilled.map((r) => r.value);

        const retryResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
        );

        const fatalResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal',
        );

        // 👉 собираем ошибки
        fatalResults.forEach((r) =>
          allErrors.push({
            error: r.error,
            targetUrl: task.metadata.target_website ?? undefined,
          }),
        );

        // 👉 следующий батч
        const nextBatch = retryResults.map((r) => r.product);

        loggerScope?.debug('Batch processed', {
          attempt,
          currentBatchLength: currentBatch.length,
          nextBatchLength: nextBatch.length,
          retryCount: retryResults.length,
          fatalCount: fatalResults.length,
          rejectedCount: rejected.length,
        });

        // 💥 КРИТИЧЕСКИЕ ЗАЩИТЫ

        // 1. нет retry → выходим
        if (nextBatch.length === 0) {
          loggerScope?.debug('No retryable tasks left, breaking loop');
          break;
        }

        // 2. нет прогресса → выходим
        if (nextBatch.length >= currentBatch.length) {
          loggerScope?.warn('No progress detected, breaking loop', {
            current: currentBatch.length,
            next: nextBatch.length,
          });
          break;
        }

        currentBatch = nextBatch;
        attempt++;
      }

      //todo закрыть все страницы pool т.к. для downloadImages() будет использоваться другой pool

      const normalized = normalizeAllData(allData);

      loggerScope?.debug('All data normalized', {
        component: 'DefaultScenario',
        method: 'process()',
        action: 'normalized = normalizeAllData(allData)',
        data: {
          normalized: normalized,
        },
      });

      //нужно при отладке текстовых процессоров
      if (this.config.downloadImages) {
        allErrors.push(
          ...(await this.downloadImages(normalized, task, context, this.limiter, loggerScope)),
        );
      }
    });

    await this.storage.appendJsonUnique(
      allProductRaw.map((item) => ({
        ...item,
        sku: String(item.sku),
      })),
      {
        filename: `${task.brand_name}_products_raw.json`,
        targetDir: '',
      },
    );
    await this.storage.saveJson(allErrors, {
      filename: `${task.brand_name}_unprocessed-products.json`,
      targetDir: '',
    });
  }

  private resolveBrandName(input: string): string {
    const normalizedInput = input.trim().toLowerCase();

    for (const [target, aliases] of Object.entries(BRAND_ALIASES)) {
      const match = aliases.find((alias) => alias.toLowerCase() === normalizedInput);

      if (match) {
        return target;
      }
    }

    return normalizedInput;
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

    const ImgPool = new PagePool(context, this.maxPageDownloadImg);

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
              return await this.browser.downloadWithFallback(
                item.url,
                page!,
                context,
                loggerScope,
                { strategy: 'static-first' },
              );
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

        const fileName = `${item.idProduct}_${item.sku.replaceAll('/', '-')}_${item.index}${_ext}`;
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
        //todo
        /**
         * если картинка не закачана её url нужно сохранить в отдельный массив для повторного скачивания!
         */

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
          attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch,
        },
      });

      const settledResults = await Promise.allSettled(
        currentBatch.map((item) => processImage(item as IImageItem)),
      );

      const rejectedResults = settledResults.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );

      rejectedResults.forEach((r, index) => {
        allErrors.push({
          error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
          targetUrl: currentBatch[index]?.url,
        });
      });

      loggerScope?.debug('Handled rejected promises from current batch', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: 'rejectedResults.forEach(...)',
        data: {
          attempt,
          rejectedCount: rejectedResults.length,
          rejectedResults,
        },
      });

      // Обрабатываем fulfilled
      const results = settledResults
        .filter((r): r is PromiseFulfilledResult<ImageResult> => r.status === 'fulfilled')
        .map((r) => r.value);

      loggerScope?.debug('Current batch processing finished', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: 'results = fulfilled values',
        data: {
          attempt,
          maxRetries: this.maxRetries,
          currentBatchLength: currentBatch.length,
          currentBatch,
          results,
        },
      });

      // retry
      const retryResults = results.filter(
        (r): r is Extract<ImageResult, { status: 'retry' }> => r.status === 'retry',
      );

      loggerScope?.debug('Filtered retryable tasks from current batch results', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: "r.status === 'retry'",
        data: {
          attempt,
          retryResults,
        },
      });

      // fatal
      const fatalResults = results.filter(
        (r): r is Extract<ImageResult, { status: 'fatal' }> => r.status === 'fatal',
      );

      loggerScope?.debug('Filtered fatal tasks from current batch results', {
        component: 'DefaultScenario',
        method: 'downloadImages()',
        action: "r.status === 'fatal'",
        data: {
          attempt,
          fatalResults,
        },
      });

      //todo!! urls не сохранённых изображений писать в отдельный файл!
      // fatalResults.forEach((r) =>
      //   allErrors.push({
      //     error: r.error,
      //     targetUrl: r.item.url,
      //   }),
      // );

      // 🔄 формируем новый батч только из retry
      currentBatch = retryResults.map((r) => r.item);

      attempt++;
    }

    return allErrors;
  }

  private async withRetry<T>(
    action: () => Promise<T>,
    options: {
      maxRetries: number;
      isRetryable: (error: IWorkerError) => boolean;
      timeoutMs?: number; // 👈 добавили
    },
    limiter: RateLimiter,
    loggerScope?: ILogger,
  ): Promise<T> {
    let attempt = 1;

    while (true) {
      try {
        const result = options.timeoutMs
          ? await Promise.race([
              action(),
              new Promise<T>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Timeout after ${options.timeoutMs}ms`)),
                  options.timeoutMs,
                ),
              ),
            ])
          : await action();

        return result;
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

        if (!options.isRetryable(workerError)) {
          throw workerError;
        }

        if (attempt >= options.maxRetries) {
          throw workerError;
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

  /* deprecated */
  // async loadSources(): Promise<ISource<ICollectProductPhotosTask>[]> {
  //   const sources: ISource<ICollectProductPhotosTask>[] = [];

  //   const walk = async (dir: string) => {
  //     const files = await fs.readdir(dir, { withFileTypes: true });

  //     for (const file of files) {
  //       const fullPath = path.resolve(dir, file.name);

  //       if (file.isDirectory()) {
  //         await walk(fullPath);
  //         continue;
  //       }

  //       if (!file.name.endsWith('.js')) continue;

  //       const sourceModule = require(fullPath);
  //       const SourceClass = sourceModule.default ?? sourceModule;

  //       sources.push(new SourceClass());
  //     }
  //   };

  //   await walk(this.sourcesFolder);

  //   return sources;
  // }

  async loadSources(): Promise<ISource<ICollectProductPhotosTask>[]> {
    const sources: ISource<ICollectProductPhotosTask>[] = [];

    const deps: ISourceDependencies = {
      flowRunner: new FlowRunner(),
      resolver: new DefaultStrategyResolver(),
      actionsFactory: new ActionsFactory(),
      logger: this.logger,
    };

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
        const definition: ISourceDefinition = sourceModule.default ?? sourceModule;

        console.log('definition = ', definition);

        sources.push(definition.create(deps));
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
