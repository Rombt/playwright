import { BrowserContext, Page } from 'playwright-core';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IScenario } from '../src/scenario/IScenario';
import { ISource } from '../src/source/ISource';
import { Storage } from '../src/storage/Storage';
import { IBrowser } from '../src/browser/IBrowser';
import { IWorkerError } from '../src/data/entities/IErrors/IWorkerError';
import { IWorkerResult } from '../src/data/entities/IResults/IWorkerResult';
import { IDownloadedFile } from '../src/browser/IDownloadedFile';
import { IDataImag } from '../src/data/entities/IDataImag';
import { ICollectProductPhotosBatch } from '../src/data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosBatch';
import { ICollectProductPhotosTask } from '../src/data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';
import { IResource } from '../src/browser/IResource';
import { RateLimiter } from '../src/browser/limiter/RateLimiter';
import { PagePool } from '../src/browser/pool/PagePool';
import { IProduct } from '../src/data/entities/IProduct';
import { AppConfig } from '../src/data/config/appConfig';
import { UnprocessedCollector } from '../src/data/collectors/UnprocessedCollector';

import { IImageItem } from '../src/data/entities/IImageItem';
import { IImageError } from '../src/data/entities/IErrors/IImageError';

import { normalizeAllData, isRetryable, waitBeforeRetry } from '../src/common/helpers';
import {
  IHttpResult,
  IAutocompleteResponse,
  IAutocompleteGood,
} from '../src/data/entities/IResults/IHttpResult';

import { Logger } from '../src/data/logger/Logger';
import { IScopedLogger } from '../src/data/logger/types/IScopedLogger';
import { ILogger } from '../src/data/logger/types/ILogger';

type TaskResult =
  | { status: 'success'; sku: string }
  | { status: 'retry'; sku: string; error: IWorkerError }
  | { status: 'fatal'; sku: string; error: IWorkerError };

type IProductLinkItem = {
  sku: string;
  link: string;
};
type IProdPageError = {
  item?: IProductLinkItem;
  error: IWorkerError;
};

export class RozetkaScenario<Browser, Context extends BrowserContext>
  implements IScenario<Browser, Context>
{
  private readonly config: AppConfig;
  private readonly maxRetries: number;
  private readonly maxPage: number;
  private readonly maxTask: number;
  private readonly sourcesFolder: string;
  private readonly logger: Logger;

  private sources: ISource<ICollectProductPhotosTask>[] = [];
  private resources: IResource[] = [];

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: Storage,
  ) {
    this.config = AppConfig.getInstance();
    this.logger = Logger.getInstance();

    this.maxRetries = this.config.asyncRetry.maxRetries;
    this.maxPage = this.config.asyncPages.maxPage;
    this.maxTask = this.config.asyncTasks.maxTask;
    this.sourcesFolder = this.config.sourcesFolder;
  }

  async run(): Promise<void> {
    try {
      const arrTasks = await this.load();

      this.logger.debug(`The array of unprocessed products was received`, {
        component: 'RozetkaScenario',
        method: 'run()',
        action: 'arrTasks = await this.load()',
        data: { arrTasks },
      });

      await this.prepare();
      await this.runWithWorkerPool(arrTasks, (task, loggerScope) =>
        this.process(task, loggerScope),
      );
    } catch (error) {
      this.logger.error('RozetkaScenario => run()', {
        component: 'RozetkaScenario',
        method: 'run',
        data: {
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    } finally {
      await this.finalize();
    }
  }

  private async runWithWorkerPool<T>(
    tasks: ICollectProductPhotosTask[],
    handler: (task: ICollectProductPhotosTask, logger?: ILogger) => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = index++;

        this.logger.debug(`Worker № ${currentIndex} is started`, {
          component: 'RozetkaScenario',
          method: 'runWithWorkerPool',
          action: 'while (true)',
          stage: 'start',
          data: {
            currentIndex: currentIndex,
          },
        });

        if (currentIndex >= tasks.length) {
          this.logger.debug('All tasks are completed', {
            component: 'RozetkaScenario',
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

        const loggerScope = this.logger.withContext(`Worker № ${currentIndex}  ${task.brand_name}`);

        loggerScope.debug('Received a new task', {
          component: 'RozetkaScenario',
          method: 'runWithWorkerPool',
          action: 'const task = tasks[currentIndex];',
          data: {
            currentIndex: currentIndex,
            task: task,
          },
        });

        try {
          loggerScope.debug('Gave task it for execution ', {
            component: 'RozetkaScenario',
            method: 'runWithWorkerPool',
            action: 'try {...}',
            data: {
              currentIndex: currentIndex,
              task: task,
            },
          });

          await handler(task, loggerScope);

          loggerScope.debug('The task execution is finish', {
            component: 'RozetkaScenario',
            method: 'runWithWorkerPool',
            action: 'try {...}',
            data: {
              currentIndex: currentIndex,
              task: task,
            },
          });
        } catch (error) {
          loggerScope.error('WorkerPool task error', {
            component: 'RozetkaScenario',
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

    await Promise.all(workers);
    this.logger.info('All task groups have been processed', {
      component: 'RozetkaScenario',
      method: 'runWithWorkerPool',
      action: 'workers = Array.from({ length: this.maxTask }, () => worker()',
      data: {
        totalTasks: tasks.length,
      },
    });
  }

  async load(): Promise<ICollectProductPhotosTask[]> {
    const unprocessedCollector = new UnprocessedCollector();
    const arrTasks = unprocessedCollector.getPhotoCollectionTasks();

    if (!Array.isArray(arrTasks)) {
      throw new Error('Task file must contain an array');
    }

    return arrTasks;
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(task: ICollectProductPhotosTask, loggerScope?: ILogger): Promise<void> {
    // const loggerScope = this.logger.withContext(task.brand_name);

    const source = this.sources.find((s) => s.supports(task)) as
      | ISource<ICollectProductPhotosTask, IAutocompleteResponse>
      | undefined;
    if (!source) {
      loggerScope?.error('Source not found for task', {
        component: 'RozetkaScenario',
        method: 'process',
        task,
      });

      throw new Error('Source not found');
    }

    loggerScope?.debug(`The enter to the process method`, {
      component: 'RozetkaScenario',
      method: 'process',
      stage: 'init',
      data: {
        task: task,
      },
    });

    const allErrors: IWorkerError[] = [];
    const allData: IDataImag = {};
    const limiter = new RateLimiter(5000);
    const productsPageLinks: Record<string, string[]> = {};

    /* 
    //!Закрыл на время розработки скачивания картинок
    await this.browser.runInContextByChromium(
      async (context) => {
        //========================    Инициализация сценария    ========================
        const url_init = 'https://rozetka.com.ua/';
        const targetUrl =
          'https://search.rozetka.com.ua/ua/search/api/v7/autocomplete/?country=UA&lang=ua&text=';

        const products = task.products;

        loggerScope?.debug(`The enter to the browser.runInContext`, {
          component: 'RozetkaScenario',
          method: 'process',
          stage: 'init',
          data: {
            url_init: url_init,
            targetUrl,
            products,
          },
        });

        if (!Array.isArray(products) || products.length === 0) {
          loggerScope?.error('Products are absent', {
            component: 'RozetkaScenario',
            method: 'process',
            stage: 'init',
            data: { task },
          });
          throw new Error('Products are absent');
        }

        const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
        loggerScope?.debug('A unique of unique products is created', {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'const uniqueProducts = Array.from(...)',
          data: {
            uniqueProducts: uniqueProducts,
          },
        });

        let taskQueue: string[] = uniqueProducts.map((p) => p.sku);
        loggerScope?.debug('A task queue s is created', {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'string[] = uniqueProducts.map(...)',
          data: {
            taskQueue: taskQueue,
          },
        });

        const quantityPage = Math.min(taskQueue.length, this.maxPage);

        const pool = new PagePool(context, quantityPage);
        this.registerResource(pool);
        //========================    /Инициализация сценария    ========================

        //========================    Обработка ОДНОГО SKU    ========================
        const processSku = async (sku: string, page: Page): Promise<TaskResult> => {
          try {
            const headers = this.buildHeaders(url_init);
            if (!headers || typeof headers !== 'object') {
              loggerScope?.error('Headers are invalid', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'processSku',
                data: {
                  headers: headers,
                },
              });

              throw new Error('Headers are invalid');
            }

            const autocomplete = await withRetry(
              () =>
                source!.workerHttpRequest(context.request, headers, targetUrl, limiter, sku, {
                  brand_name: task.brand_name,
                }),
              {
                maxRetries: this.config.asyncRetry.maxRetries,
                isRetryable,
              },
            );

            if (!autocomplete.ok || !autocomplete.body) {
              loggerScope?.error('autocomplete is invalid', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'autocomplete = await withRetry(...)',
                stage: 'start',
                data: {
                  result: autocomplete,
                },
              });

              throw new Error(
                `One of the results from source.workerHttpRequest() is invalid  ${autocomplete}`,
              );
            }

            for (const g of autocomplete.body?.data.content.records.goods ?? []) {
              if (!this.isAutocompleteGood(g)) {
                loggerScope?.debug('Missing or invalid goods in the workerHttpRequest results', {
                  component: 'RozetkaScenario',
                  method: 'process',
                  action: 'for (const g of autocomplete.body?.data.content.records.goods ?? [])',
                  data: {
                    sku: g,
                  },
                });
                continue;
              }

              if (!g.title.includes(sku)) continue;

              loggerScope?.debug('Product contains required SKU in the title', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'if (!g.title.includes(sku)) continue;',
                data: {
                  sku: sku,
                  currentProduct: g,
                },
              });

              // сбор фото у найденных товаров
              const result = await withRetry(
                () =>
                  source.worker(g.href, page, limiter, undefined, sku, {
                    brand_name: task.brand_name,
                  }),
                {
                  maxRetries: this.config.asyncRetry.maxRetries,
                  isRetryable,
                },
              );

              loggerScope?.debug(
                `The collection of photos url for   ${task.brand_name}    ${sku}    is complete`,
                {
                  component: 'RozetkaScenario',
                  method: 'process',
                  action: 'const result = await withRetry(...)',
                  data: {
                    attempt: attempt,
                    result: result,
                  },
                },
              );

              //!!!!!!!!!!!!!!!
              //todo при удачном сборе фото для данного sku нужно удалять этот товар из файла не обработанных товаров
              //!!!!!!!!!!!!!!!

              for (const r of result) {
                for (const [skuKey, images] of Object.entries(r.data)) {
                  loggerScope?.debug(`Found url photo for   ${task.brand_name}    ${skuKey}`, {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'for (const r of result) {...}',
                    data: {
                      attempt: attempt,
                    },
                  });

                  allData[skuKey] ??= [];
                  allData[skuKey].push(...images);
                }
              }
            }

            loggerScope?.debug(`The process  ${task.brand_name}    ${sku}    is complete`, {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'for (const r of result) {...}',
              data: {
                attempt: attempt,
                allData: allData,
              },
            });

            return { status: 'success', sku };
          } catch (e) {
            loggerScope?.error(`Error during processing ${sku}  `, {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'const result = await withRetry(...)',
              data: {
                attempt: attempt,
                status: status,
                error: e,
              },
            });

            return isRetryable(e as IWorkerError)
              ? { status: 'retry', sku, error: e as IWorkerError }
              : { status: 'fatal', sku, error: e as IWorkerError };
          }
        };

        //========================   Batch runner      ========================
        async function runBatch(skus: string[]): Promise<TaskResult[]> {
          const queue = [...skus];
          const results: TaskResult[] = [];

          loggerScope?.debug(`Batch runner is started`, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'runBatch(skus: string[])',
            data: {
              attempt: attempt,
              currentBatchLength: currentBatch.length,
              currentBatch: currentBatch,
              queue: queue,
              results: results,
            },
          });

          const workers = Array.from({ length: quantityPage }, async () => {
            const page = await pool.acquire();

            loggerScope?.debug(`Workers into Batch runner is started`, {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'const workers = Array.from(...)',
              data: {
                url_init: url_init,
                page: page,
              },
            });

            try {
              const response = await page.goto(url_init, { waitUntil: 'domcontentloaded' });

              loggerScope?.debug(`Try to go to ${url_init}`, {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'response = await page.goto(...)',
                data: {
                  url_init: url_init,
                  response: response,
                },
              });

              if (!response?.ok()) {
                throw new Error(`Navigation failed: ${response?.status()}`);
              }

              while (queue.length) {
                const sku = queue.shift();
                if (!sku) {
                  loggerScope?.error(`sku is absent`, {
                    component: 'PageImageSourceRozetka',
                    method: 'process',
                    action: 'while (queue.length)',
                    stage: 'start',
                    data: {
                      sku: sku,
                    },
                  });
                  throw new Error(`In process method sku is absent`);
                }

                const rawSku = sku;
                const starIndex = rawSku.indexOf('*');
                const skuNormal =
                  (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
                    /^[\p{C}\s]+|[\p{C}\s]+$/gu,
                    '',
                  ) ?? '';

                const result = await processSku(skuNormal, page);
                results.push(result);
              }
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));

              loggerScope?.error(`Error into workers into Batch runner`, {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'catch (err)',
                data: {
                  attempt: attempt,
                  currentBatchLength: currentBatch.length,
                  currentBatch: currentBatch,
                  queue: queue,
                  results: results,
                  url_init: url_init,
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                },
              });
            } finally {
              pool.release(page);
            }
          });

          await Promise.all(workers);
          return results;
        }

        //========================  Retry wrapper (ЕДИНСТВЕННЫЙ)     ========================
        async function withRetry<T>(
          action: () => Promise<T>,
          options: {
            maxRetries: number;
            isRetryable: (error: IWorkerError) => boolean;
            onRetry?: (attempt: number, error: unknown) => void;
          },
        ): Promise<T> {
          let attempt = 1;

          loggerScope?.debug('withRetry() starting .... ', {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'async function withRetry(...){...}',
            data: {
              attempt: attempt,
              action: action,
              options: options,
            },
          });

          while (true) {
            try {
              return await action();
            } catch (e) {
              if (attempt >= options.maxRetries || !options.isRetryable(e as IWorkerError)) {
                loggerScope?.error('In withRetry() error don`t fixed  ', {
                  component: 'RozetkaScenario',
                  method: 'process',
                  action: 'async function withRetry(...){...}',
                  data: {
                    attempt: attempt,
                    action: action,
                    options: options,
                    error: e,
                  },
                });

                throw e;
              }

              loggerScope?.error('In withRetry() try fix error  ', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'async function withRetry(...){...}',
                data: {
                  attempt: attempt,
                  action: action,
                  options: options,
                  error: e,
                },
              });

              options.onRetry?.(attempt, e);
              await waitBeforeRetry(attempt);
              attempt++;
            }
          }
        }

        //========================   ГЛАВНЫЙ RETRY ЦИКЛ     ========================
        let attempt = 1;
        let currentBatch = taskQueue;

        while (currentBatch.length && attempt <= this.maxRetries) {
          await limiter.sleep(1000, 5000);

          loggerScope?.debug(`Main retry cycle is started`, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'while (currentBatch.length && attempt <= this.maxRetries) {...}',
            data: {
              attempt: attempt,
              currentBatchLength: currentBatch.length,
              currentBatch: currentBatch,
            },
          });

          const results: TaskResult[] = await runBatch.call(this, currentBatch);

          const retryResults = results.filter(
            (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
          );

          loggerScope?.debug(`Received retry results `, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'const results: TaskResult[] = await runBatch.call(this, currentBatch);',
            data: {
              attempt: attempt,
              retryResults: retryResults,
            },
          });

          const fatalResults = results.filter(
            (r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal',
          );

          loggerScope?.debug(`Received fatal results `, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'const results: TaskResult[] = await runBatch.call(this, currentBatch);',
            data: {
              attempt: attempt,
              fatalResults: fatalResults,
            },
          });

          currentBatch = retryResults.map((r) => r.sku);

          fatalResults.forEach((r) =>
            allErrors.push({
              error: r.error,
              targetUrl,
            }),
          );

          attempt++;
        }

        //========================   /ГЛАВНЫЙ RETRY ЦИКЛ     ========================
      },
      'fake',
      loggerScope,
    );

    const allDataNormalize = normalizeAllData(allData);
    loggerScope?.info(`The process of    ${task.brand_name}    is complete`, {
      component: 'RozetkaScenario',
      method: 'process',
      action: 'const allDataNormalize = normalizeAllData(allData)',
      data: {
        allDataNormalize: allDataNormalize,
      },
    });

      //!/Закрыл на время розработки скачивания картинок
    */

    // await limiter.sleep(1000, 5000);

    const productsPageLinks_test = {
      '1865231': ['https://rozetka.com.ua/ua/columbia_0990037254005_0192660465388/p388246605/'],
      '2079181': ['https://rozetka.com.ua/ua/columbia-195981582994/p446003411/'],
      '2103761': ['https://rozetka.com.ua/ua/columbia-195981625394/p446018603/'],
    };

    await this.browser.runInContextByChromium(
      async (context) => {
        //========================    Скачивание фотографий по полученным URLs    ========================
        const limiter = new RateLimiter(5000);

        const taskQueueProdPage: IProductLinkItem[] = [];
        for (const [sku, links] of Object.entries(productsPageLinks)) {
          for (const link of links) {
            taskQueueProdPage.push({ sku, link });
          }
        }

        loggerScope?.debug('Product page task queue is created', {
          component: 'ProductPageScenario',
          method: 'process',
          action: 'taskQueueProdPage push',
          data: {
            length: taskQueueProdPage.length,
            taskQueueProdPage,
          },
        });

        if (!taskQueueProdPage.length) {
          loggerScope?.error('Product page links are absent', {
            component: 'ProductPageScenario',
            method: 'process',
            stage: 'init',
            data: { productsPageLinks },
          });
          throw new Error('Product page links are absent');
        }

        const quantityPage = Math.min(taskQueueProdPage.length, this.maxPage);
        const pool = new PagePool(context, quantityPage);
        this.registerResource(pool);

        //========================    Обработка ОДНОГО URL    ========================
        const processProductLink = async (
          item: IProductLinkItem,
          page: Page,
        ): Promise<TaskResult> => {
          try {
            const result = await source.worker(item.link, page, limiter, undefined, item.sku);

            loggerScope?.debug('Product page parsed', {
              component: 'ProductPageScenario',
              method: 'process',
              action: 'source.worker(...)',
              data: {
                sku: item.sku,
                link: item.link,
                result: result,
              },
            });

            for (const r of result) {
              for (const [skuKey, images] of Object.entries(r.data)) {
                allData[skuKey] ??= [];
                allData[skuKey].push(...images);
              }

              if (Array.isArray(r.errors)) {
                for (const err of r.errors) {
                  await this.handleError(err);
                }
              }
            }

            return { status: 'success', sku: item.sku };
          } catch (e) {
            loggerScope?.error('Error during product page processing', {
              component: 'ProductPageScenario',
              method: 'process',
              action: 'processProductLink',
              data: {
                sku: item.sku,
                link: item.link,
                error: e,
              },
            });

            return isRetryable(e as IWorkerError)
              ? { status: 'retry', sku: item.sku, error: e as IWorkerError }
              : { status: 'fatal', sku: item.sku, error: e as IWorkerError };
          }
        };
        //========================    /Обработка ОДНОГО LINK    ========================

        //========================    Batch runner    ========================
        const runBatch = async (items: IProductLinkItem[]): Promise<TaskResult[]> => {
          const queue = [...items];
          const results: TaskResult[] = [];

          loggerScope?.debug('Batch runner for product pages started', {
            component: 'ProductPageScenario',
            method: 'process',
            action: 'runBatch',
            data: {
              queueLength: queue.length,
              queue,
            },
          });

          const workers = Array.from({ length: quantityPage }, async () => {
            const page = await pool.acquire();

            try {
              while (queue.length) {
                const item = queue.shift();
                if (!item) break;

                const result = await processProductLink(item, page);
                results.push(result);
              }
            } catch (err) {
              loggerScope?.error('Worker error in product page batch', {
                component: 'ProductPageScenario',
                method: 'process',
                action: 'worker catch',
                data: {
                  error: err,
                },
              });
            } finally {
              pool.release(page);
            }
          });

          await Promise.all(workers);
          return results;
        };
        //========================    /Batch runner    ========================

        //========================    ГЛАВНЫЙ RETRY ЦИКЛ    ========================
        let attempt = 1;
        let currentBatch = taskQueueProdPage;

        while (currentBatch.length && attempt <= this.maxRetries) {
          loggerScope?.debug('Main retry cycle for product pages started', {
            component: 'ProductPageScenario',
            method: 'process',
            action: 'main retry loop',
            data: {
              attempt,
              currentBatchLength: currentBatch.length,
            },
          });

          await limiter.sleep(1000, 5000);

          const results = await runBatch(currentBatch);

          const retryResults = results.filter(
            (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
          );

          const fatalResults = results.filter(
            (r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal',
          );

          currentBatch = currentBatch.filter((item) =>
            retryResults.some((r) => r.sku === item.sku),
          );

          fatalResults.forEach((r) =>
            allErrors.push({
              error: r.error,
            }),
          );

          attempt++;
        }

        loggerScope?.debug('Product page processing complete', {
          component: 'ProductPageScenario',
          method: 'process',
          data: {
            allData,
            allErrors,
          },
        });
        //========================    /ГЛАВНЫЙ RETRY ЦИКЛ    ========================
      },
      'fake',
      loggerScope,
    );

    // await this.storage.saveJson(allErrors, {
    //   filename: `${task.brand_name}_unprocessed-products.json`,
    //   targetDir: task.brand_name,
    // });
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

  getUnprocessedProducts(errors: IWorkerError[]): IProduct[] {
    console.log('getUnprocessedProducts    errors = ', errors);

    const unprocessedProducts = Array.from(
      new Map(
        errors.filter((e) => e.product).map((e) => [e.product!.id_product, e.product!]),
      ).values(),
    );
    return unprocessedProducts;
  }

  async finalize(): Promise<void> {
    for (const res of this.resources) {
      try {
        await res.close();
      } catch (err) {
        console.warn('Error closing resource:', err);
      } finally {
        this.browser.close(); //todo не уверен по поводу этого места закрытия браузера
      }
    }
  }

  async handleError(
    error: IWorkerError,
    attempt: number = 1,
    context?: { sku?: string; loggerScope?: ILogger; debugMeta?: Record<string, string> },
  ): Promise<void> {
    context?.loggerScope?.error(`Worker error on attempt ${attempt}`, {
      component: 'PageImageSourceRozetka',
      method: 'handleError',
      action: 'retry_logic',
      stage: 'error_caught',
      data: {
        attempt,
        sku: context?.sku,
        debugMeta: context?.debugMeta,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    // Проверяем возможность повторной попытки
    if (attempt < this.config.asyncRetry.maxRetries && isRetryable(error)) {
      const delay = await waitBeforeRetry(attempt);

      context?.loggerScope?.debug(`Retrying after delay ${delay}ms`, {
        component: 'PageImageSourceRozetka',
        method: 'handleError',
        action: 'retry_logic',
        stage: 'retry_scheduled',
        data: { attempt, delay },
      });

      return this.handleError(error, attempt + 1, context);
    }

    // Если retries исчерпаны — пробрасываем ошибку
    throw error;
  }

  buildHeaders(refer: string = '') {
    const languages = ['uk-UA,uk;q=0.9', 'uk-UA,uk;q=0.8,en;q=0.5'];

    const index = Math.floor(Math.random() * languages.length);

    return {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': languages[index],
      Referer: refer,
    };
  }

  isAutocompleteGood(obj: unknown): obj is IAutocompleteGood {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'title' in obj &&
      typeof (obj as any).title === 'string' &&
      'href' in obj &&
      typeof (obj as any).href === 'string'
    );
  }
}
