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
import { AppConfig } from '../../data/config/appConfig';
import { UnprocessedCollector } from '../../data/collectors/UnprocessedCollector';

import { IImageItem } from '../../data/entities/IImageItem';
import { IImageError } from '../../data/entities/IErrors/IImageError';

import { normalizeAllData, isRetryable, waitBeforeRetry } from '../../common/helpers';
import {
  IHttpResult,
  IAutocompleteResponse,
  IAutocompleteGood,
} from '../../data/entities/IResults/IHttpResult';

import { Logger } from '../../data/logger/Logger';
import { IScopedLogger } from '../../data/logger/types/IScopedLogger';
import { ILogger } from '../../data/logger/types/ILogger';
import { SharpImageProcessor as ImageProcessor } from '../../processing/ImageProcessor/SharpImageProcessor';

type TaskResult =
  | { status: 'success'; sku: string }
  | { status: 'retry'; sku: string; error: IWorkerError }
  | { status: 'fatal'; sku: string; error: IWorkerError };

type ImageTaskResult =
  | { status: 'success'; item: IImageItem }
  | { status: 'retry'; item: IImageItem; error: IWorkerError }
  | { status: 'fatal'; item: IImageItem; error: IWorkerError };

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
  private allErrors: IWorkerError[] = [];

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

    this.maxRetries = this.config.asyncRetry.maxRetries;
    this.maxPage = this.config.asyncPages.maxPage;
    this.maxTask = this.config.asyncTasks.maxTask;
    this.sourcesFolder = this.config.sourcesFolder;
    this.taskPath = this.config.taskPath;
  }

  async run(brands?: string[]): Promise<void> {
    try {
      const arrTasks = await this.load(brands);

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
              task: task,
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
      component: 'RozetkaScenario',
      method: 'runWithWorkerPool',
      action: 'workers = Array.from({ length: this.maxTask }, () => worker()',
      data: {
        totalTasks: tasks.length,
      },
    });
  }

  async load(brands?: string[]): Promise<ICollectProductPhotosTask[]> {
    let arrTasks;

    if (this.mode === 'retry') {
      const unprocessedCollector = new UnprocessedCollector();
      arrTasks = unprocessedCollector.getPhotoCollectionTasks(this.mode);
    } else if (this.mode === 'full') {
      arrTasks = await this.loadTasks(brands);

      arrTasks.forEach((task) => {
        task.type = 'recollect-product-photos';
        task.metadata.target_website = null;
      });
    }

    this.logger.debug(`The array of tasks was received`, {
      component: 'RozetkaScenario',
      method: 'load()',
      action: '',
      data: {
        thisMode: this.mode,
        arrTasks: arrTasks,
      },
    });

    if (!Array.isArray(arrTasks)) {
      throw new Error('Task file must contain an array');
    }

    return arrTasks;
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
    const source = this.sources.find((s) => s.supports(task)) as
      | ISource<ICollectProductPhotosTask, IAutocompleteResponse>
      | undefined;
    if (!source) {
      loggerScope?.error('Source not found for task', {
        component: 'RozetkaScenario',
        method: 'process',
        action: 'if (!source)',
        task: task,
      });

      throw new Error('Source not found');
    }

    loggerScope?.debug(`The enter to the process method`, {
      component: 'RozetkaScenario',
      method: 'process',
      stage: 'init',
      data: {
        task: task,
        source: source,
      },
    });

    const allData: IDataImag = {};
    const limiter = new RateLimiter(5000);
    const productsPageLinks: Record<string, string[]> = {};

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
            targetUrl: targetUrl,
            products: products,
          },
        });

        if (!Array.isArray(products) || products.length === 0) {
          loggerScope?.error('Products are absent', {
            component: 'RozetkaScenario',
            method: 'process',
            stage: 'init',
            data: { task: task },
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

        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!4
        let taskQueue: IProduct[] = uniqueProducts.map((p) => p);
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
        const processProduct = async (product: IProduct, page: Page): Promise<TaskResult> => {
          if (!product.sku) {
            loggerScope?.error(`sku is absent`, {
              component: 'PageImageSourceRozetka',
              method: 'process',
              action: 'while (queue.length)',
              stage: 'start',
              data: {
                sku: product.sku,
              },
            });
            throw new Error(`In process method sku is absent`);
          }

          const rawSku = product.sku;
          const starIndex = rawSku.indexOf('*');
          const skuNormal =
            (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
              /^[\p{C}\s]+|[\p{C}\s]+$/gu,
              '',
            ) ?? '';

          try {
            const headers = this.buildHeaders(url_init);
            if (!headers || typeof headers !== 'object') {
              loggerScope?.error('Headers are invalid', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'processProduct',
                data: {
                  headers: headers,
                },
              });

              throw new Error('Headers are invalid');
            }

            const autocomplete = await this.withRetry(
              () =>
                source!.workerHttpRequest(
                  context.request,
                  headers,
                  targetUrl,
                  limiter,
                  skuNormal,
                  {
                    brand_name: task.brand_name,
                  },
                  loggerScope,
                ),
              {
                maxRetries: this.config.asyncRetry.maxRetries,
                isRetryable,
              },
              loggerScope,
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

              if (!g.title.includes(product.sku)) continue;

              loggerScope?.debug('Product contains required SKU in the title', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'if (!g.title.includes(sku)) continue;',
                data: {
                  sku: product.sku,
                  currentProduct: g,
                },
              });

              // сбор фото у найденных товаров
              const result = await this.withRetry(
                () =>
                  source.worker(g.href, page, limiter, product, undefined, product.sku, {
                    //!!!!!!!!!!!!!!!!1
                    brand_name: task.brand_name,
                  }),
                {
                  maxRetries: this.config.asyncRetry.maxRetries,
                  isRetryable,
                },
                loggerScope,
              );

              loggerScope?.debug(
                `The collection of photos url for   ${task.brand_name}    ${product.sku}    is complete`,
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

              for (const r of result) {
                for (const [skuKey, images] of Object.entries(r.data.images ?? {}) as [
                  string,
                  IDataImagItem,
                ][]) {
                  loggerScope?.debug(`Found url photo for ${task.brand_name} ${skuKey}`, {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'for (const r of result) {...}',
                    data: {
                      attempt: attempt,
                      skuKey: skuKey,
                      images: images,
                      idProduct: images.idProduct, // теперь доступно
                    },
                  });

                  const resultsDirPath = path.resolve(
                    __dirname,
                    '../../../results', //todo задать через конфиг
                    task.brand_name,
                    `${task.brand_name}_unprocessed-products.json`,
                  );

                  await this.removeItemBySku(resultsDirPath, skuKey, loggerScope);

                  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!2
                  // Создаем массив, если еще нет, и сохраняем idProduct
                  if (!allData[skuKey]) {
                    const arr = [] as unknown as IDataImagItem;
                    arr.idProduct = images.idProduct;
                    allData[skuKey] = arr;
                  }

                  allData[skuKey].push(...images);
                }
              }
            }

            loggerScope?.debug(`The process  ${task.brand_name}    ${product.sku}    is complete`, {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'for (const r of result) {...}',
              data: {
                attempt: attempt,
                allData: allData,
              },
            });

            return { status: 'success', sku: product.sku };
          } catch (e) {
            loggerScope?.error(`Error during processing ${product.sku}  `, {
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
              ? { status: 'retry', sku: product.sku, error: e as IWorkerError }
              : { status: 'fatal', sku: product.sku, error: e as IWorkerError };
          }
        };

        //========================   Batch runner      ========================
        async function runBatch(products: IProduct[]): Promise<TaskResult[]> {
          const queue = [...products];
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
                const product = queue.shift();
                // if (!sku) {
                //   loggerScope?.error(`sku is absent`, {
                //     component: 'PageImageSourceRozetka',
                //     method: 'process',
                //     action: 'while (queue.length)',
                //     stage: 'start',
                //     data: {
                //       sku: sku,
                //     },
                //   });
                //   throw new Error(`In process method sku is absent`);
                // }

                // const rawSku = sku;
                // const starIndex = rawSku.indexOf('*');

                // // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!3
                // const skuNormal =
                //   (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(
                //     /^[\p{C}\s]+|[\p{C}\s]+$/gu,
                //     '',
                //   ) ?? '';

                if (!product) return;
                const result = await processProduct(product, page);
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
                  errorName: error.name,
                },
              });
            } finally {
              pool.release(page);
            }
          });

          await Promise.allSettled(workers);
          return results;
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

          loggerScope?.debug(`Received ALL results`, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'const results: TaskResult[] = await runBatch.call(this, currentBatch);',
            data: {
              attempt: attempt,
              results: results,
            },
          });

          const retryResults = results.filter(
            (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
          );

          loggerScope?.debug(`Received retry results`, {
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

          loggerScope?.debug(`Received fatal results`, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'const results: TaskResult[] = await runBatch.call(this, currentBatch);',
            data: {
              attempt: attempt,
              fatalResults: fatalResults,
            },
          });

          // currentBatch = retryResults.map((r) => r.sku); //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!5
          currentBatch = retryResults
            .map((r) => taskQueue.find((p) => p.sku === r.sku))
            .filter((p): p is IProduct => p !== undefined);

          fatalResults.forEach((r) =>
            this.allErrors.push({
              error: r.error,
              targetUrl,
            }),
          );

          attempt++;
        }

        //========================   /ГЛАВНЫЙ RETRY ЦИКЛ     ========================

        const allDataNormalize = normalizeAllData(allData);
        loggerScope?.info(`The process of    ${task.brand_name}    is complete`, {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'const allDataNormalize = normalizeAllData(allData)',
          data: {
            allDataNormalize: allDataNormalize,
          },
        });

        await this.downloadImages(allDataNormalize, task, context, limiter, loggerScope);
      },
      'fake',
      loggerScope,
    );
  }

  private async downloadImages(
    UrlsBySku: Record<string, string[]>,
    task: { brand_name: string },
    context: BrowserContext,
    limiter: RateLimiter,
    loggerScope?: ILogger,
  ): Promise<void> {
    //========================    Инициализация очереди    ========================

    const urlsQueue: IImageItem[] = [];

    for (const [sku, urls] of Object.entries(UrlsBySku) as [string, IDataImagItem][]) {
      urls.forEach((url, i) => {
        urlsQueue.push({
          sku,
          url,
          index: i + 1,
          idProduct: urls.idProduct, // берем из массива
        });
      });
    }

    loggerScope?.debug(`Created a queue of images for download`, {
      component: 'RozetkaScenario',
      method: 'downloadImages',
      action: 'urlsQueue.push({ sku, url, index: i + 1 })',
      data: {
        UrlsBySku: UrlsBySku,
        urlsQueue: urlsQueue,
      },
    });
    //========================    Обработка одного изображения    ========================

    const downloadImageItem = async (
      item: IImageItem,
      context: BrowserContext,
    ): Promise<ImageTaskResult> => {
      const { sku, url, index } = item;

      try {
        loggerScope?.debug(`Starting download of image file`, {
          component: 'RozetkaScenario',
          method: 'downloadImages',
          action: 'downloadImageItem',
          data: { sku: sku, url: url, index: index, context },
        });

        const { buffer, ext } = await this.withRetry(
          () =>
            limiter.schedule(() => this.browser.downloadStaticResource(url, context, loggerScope)),
          {
            maxRetries: this.config.asyncRetry.maxRetries,
            isRetryable,
          },
          loggerScope,
        );

        let _buf = buffer;
        let _ext = ext;

        if (this.config.convertToJpg) {
          const imageProcessor: ImageProcessor = new ImageProcessor(this.storage);
          _buf = await imageProcessor.convertBufferToJpg(buffer);
          _ext = '.jpg';
        }

        const fileName = `${item.idProduct}_${item.index}_R_${_ext}`;

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

        return { status: 'success', item };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        loggerScope?.error(`Error during image processing`, {
          component: 'ImageDownloadScenario',
          method: 'downloadImages',
          action: 'downloadImageItem',
          data: {
            sku: sku,
            url: url,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        return isRetryable(err as IWorkerError)
          ? { status: 'retry', item, error: err as IWorkerError }
          : { status: 'fatal', item, error: err as IWorkerError };
      }
    };

    //========================    Batch runner    ========================

    const runBatchImages = async (items: IImageItem[]): Promise<ImageTaskResult[]> => {
      const queue = [...items];
      const results: ImageTaskResult[] = [];

      const quantityPage = Math.min(queue.length, this.maxPage);

      loggerScope?.debug(`Entering const runBatchImages`, {
        component: 'RozetkaScenario',
        method: 'downloadImages',
        data: {
          quantityPage: quantityPage,
        },
      });

      const workers = Array.from({ length: quantityPage }, async () => {
        // const page = await pool.acquire();

        try {
          while (queue.length) {
            const item = queue.shift();

            loggerScope?.debug(`Entering  const workers ...`, {
              component: 'RozetkaScenario',
              method: 'downloadImages',
              action: 'while (...)',
              data: {
                queueLength: queue.length,
                item: item,
              },
            });

            if (!item) {
              loggerScope?.error(`Error while dequeuing item from queue.`, {
                component: 'RozetkaScenario',
                method: 'downloadImages',
                action: 'while (...)',
                data: {
                  queueLength: queue.length,
                  item: item,
                },
              });

              continue;
            }

            const result = await downloadImageItem(item, context);
            results.push(result);
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          loggerScope?.error(`Error occurred while processing image item.`, {
            component: 'RozetkaScenario',
            method: 'downloadImages',
            action: 'while (...)',
            data: {
              errorName: error instanceof Error ? error.name : undefined,
              errorMessage: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
          });
        } finally {
          // pool.release(page);
        }
      });

      await Promise.allSettled(workers);
      return results;
    };

    //========================    ГЛАВНЫЙ RETRY ЦИКЛ    ========================

    let attempt = 1;
    let currentBatch = urlsQueue;

    while (currentBatch.length && attempt <= this.maxRetries) {
      await limiter.sleep(1000, 5000);

      loggerScope?.debug(`Main download image retry cycle started`, {
        component: 'RozetkaScenario',
        method: 'downloadImages',
        action: 'while (currentBatch.length && attempt <= this.maxRetries)',
        data: {
          attempt: attempt,
          batchLength: currentBatch.length,
          currentBatch: currentBatch,
        },
      });

      const results = await runBatchImages(currentBatch);

      loggerScope?.debug(`Current batch of images processed successfully`, {
        component: 'RozetkaScenario',
        method: 'downloadImages',
        action: 'while (currentBatch.length && attempt <= this.maxRetries)',
        data: {
          attempt: attempt,
          batchLength: currentBatch.length,
          currentBatch: currentBatch,
          results: results,
        },
      });

      const retryResults = results.filter(
        (r): r is Extract<ImageTaskResult, { status: 'retry' }> => r.status === 'retry',
      );

      loggerScope?.debug(`Retry results extracted successfully.`, {
        component: 'RozetkaScenario',
        method: 'downloadImages',
        action: 'while (currentBatch.length && attempt <= this.maxRetries)',
        data: {
          attempt: attempt,
          batchLength: currentBatch.length,
          currentBatch: currentBatch,
          retryResults: retryResults,
        },
      });

      const fatalResults = results.filter(
        (r): r is Extract<ImageTaskResult, { status: 'fatal' }> => r.status === 'fatal',
      );

      loggerScope?.debug(`Fatal results extracted successfully`, {
        component: 'RozetkaScenario',
        method: 'downloadImages',
        action: 'while (currentBatch.length && attempt <= this.maxRetries)',
        data: {
          attempt: attempt,
          batchLength: currentBatch.length,
          currentBatch: currentBatch,
          fatalResults: fatalResults,
        },
      });

      currentBatch = retryResults.map((r) => r.item);

      fatalResults.forEach((r) =>
        this.allErrors.push({
          error: r.error,
          targetUrl: r.item.url,
        }),
      );

      attempt++;
    }

    //========================    /downloadImages    ========================
  }

  private async withRetry<T>(
    action: () => Promise<T>,
    options: {
      maxRetries: number;
      isRetryable: (error: IWorkerError) => boolean;
      onRetry?: (attempt: number, error: unknown) => void;
    },
    loggerScope?: ILogger,
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
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (attempt >= options.maxRetries || !options.isRetryable(err as IWorkerError)) {
          loggerScope?.error('In withRetry() error don`t fixed  ', {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'async function withRetry(...){...}',
            data: {
              attempt: attempt,
              action: action,
              options: options,
              errorName: error instanceof Error ? error.name : undefined,
              errorMessage: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
          });

          throw err;
        }

        loggerScope?.error('In withRetry() try fix error  ', {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'async function withRetry(...){...}',
          data: {
            attempt: attempt,
            action: action,
            options: options,
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });

        options.onRetry?.(attempt, err);
        await waitBeforeRetry(attempt);
        attempt++;
      }
    }
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
        console.warn('Error closing resource:', err);
      } finally {
        //todo вынести в setting.ts
        const profileDir = path.resolve('./browser-profiles/chrome-profiles');

        this.browser.close(profileDir); //todo не уверен по поводу этого места закрытия браузера
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

  async removeItemBySku(
    filePath: string,
    skuToRemove: string,
    loggerScope?: ILogger,
  ): Promise<boolean> {
    loggerScope?.debug(`The inter to the removeItemBySku(...)`, {
      component: 'RozetkaScenario',
      method: 'removeItemBySku(...)',
      stage: 'start',
      data: {
        filePath: filePath,
        skuToRemove: skuToRemove,
      },
    });

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      if (!fileContent.trim()) {
        loggerScope?.debug(`Content is absent in the file`, {
          component: 'RozetkaScenario',
          method: 'removeItemBySku(...)',
          action: 'fileContent = await fs.readFile(...)',
          data: {
            filePath: filePath,
            skuToRemove: skuToRemove,
          },
        });

        return false;
      }

      const data: IImageError[] = JSON.parse(fileContent);

      loggerScope?.debug(`Received to the unprocessed products file`, {
        component: 'RozetkaScenario',
        method: 'removeItemBySku(...)',
        action: 'data: IImageError[] = JSON.parse(fileContent)',
        data: {
          filePath: filePath,
          skuToRemove: skuToRemove,
          data: data,
        },
      });

      const initialLength = data.length;

      const filtered = data.filter((item) => item?.error?.product?.sku.includes(skuToRemove));

      if (filtered.length === initialLength) {
        loggerScope?.debug(`Failed to remove SKU from file`, {
          component: 'RozetkaScenario',
          method: 'removeItemBySku(...)',
          action: 'fileContent = await fs.readFile(...)',
          data: {
            filePath: filePath,
            skuToRemove: skuToRemove,
          },
        });

        return false;
      }

      await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf-8');

      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      loggerScope?.error(`Failed to read or write file`, {
        component: 'RozetkaScenario',
        method: 'removeItemBySku(...)',
        action: 'fileContent = await fs.readFile(...)',
        data: {
          filePath: filePath,
          skuToRemove: skuToRemove,
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      console.error('Failed to read or write file:', err);
      throw err;
    }
  }
}
