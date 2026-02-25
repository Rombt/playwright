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
import { IHttpResult, IAutocompleteResponse } from '../src/data/entities/IResults/IHttpResult';

import { Logger } from '../src/data/logger/Logger';
import { IScopedLogger } from '../src/data/logger/types/IScopedLogger';
import { ILogger } from '../src/data/logger/types/ILogger';

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
      await this.prepare();

      for (let i = 0; i < arrTasks.length; i += this.maxTask) {
        const batch = arrTasks.slice(i, i + this.maxTask);
        await Promise.all(batch.map((task) => this.process(task)));
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('RozetkaScenario => run()', {
          component: 'RozetkaScenario',
          method: 'run',
          data: {
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      } else {
        this.logger.error('RozetkaScenario => run()', {
          component: 'RozetkaScenario',
          method: 'run',
          data: {
            errorName: error instanceof Error ? error.name : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    } finally {
      await this.finalize();
    }
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

  async process(task: ICollectProductPhotosTask): Promise<void> {
    const loggerScope = this.logger.withContext(task.brand_name);

    const source = this.sources.find((s) => s.supports(task));
    if (!source) {
      loggerScope.error('Source not found for task', {
        component: 'RozetkaScenario',
        method: 'process',
        task,
      });

      throw new Error('Source not found');
    }

    const allErrors: IWorkerError[] = [];
    const allData: IDataImag = {};
    const limiter = new RateLimiter(5000);
    const productsPageLinks: Record<string, string[]> = {};
    // await this.browser.runInContext(async context => { //todo не забыть убрать
    await this.browser.runInContextByChromium(async (context) => {
      const url_init: string = 'https://rozetka.com.ua/';
      const targetUrl: string =
        'https://search.rozetka.com.ua/ua/search/api/v7/autocomplete/?country=UA&lang=ua&text=';

      const products = task.products;

      if (!Array.isArray(products) || products.length === 0) {
        loggerScope.error('Products are absent', {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'runInContextByChromium(...)',
          stage: 'init',
          data: {
            task: task,
          },
        });
      }

      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
      const queue = [...uniqueProducts];

      if (!Array.isArray(queue) || queue.length === 0) {
        loggerScope.error('The queue of unique products was not received', {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'getting uniqueProducts',
          stage: 'finish',
          data: {
            task: task,
          },
        });

        throw new Error('The queue of unique products was not received');
      }

      loggerScope.debug('A queue of unique products is created', {
        component: 'RozetkaScenario',
        method: 'process',
        action: 'getting uniqueProducts',
        stage: 'finish',
        data: {
          queue: queue,
        },
      });

      const quantityPage = Math.min(queue.length, this.maxPage);
      const pool = new PagePool(context, quantityPage);
      this.registerResource(pool);

      // //todo  Убрать!
      type ITaskError = {
        item?: IProduct;
        error: IWorkerError;
      };

      let taskQueue: IProduct[] = [...queue];

      const runBatch = async (items: IProduct[]): Promise<ITaskError[]> => {
        const errors: ITaskError[] = [];
        let index = 0;

        loggerScope.debug('runBatch started', {
          component: 'RozetkaScenario',
          method: 'process',
          action: 'runBatch',
          index: index,
          errors: errors,
        });

        const getNext = (): IProduct | undefined => {
          if (index >= items.length) return undefined;

          loggerScope.debug('getNext', {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'getNext',
            itemsLength: items.length,
            index: index,
          });

          return items[index++];
        };

        const workers = Array.from({ length: quantityPage }, async () => {
          const page = await pool.acquire();
          loggerScope.debug('A page from the pool is received', {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'new PagePool(...)',
            stage: 'finish',
            data: {
              pool: pool,
            },
          });

          const response = await page.goto(url_init, { waitUntil: 'domcontentloaded' });

          if (!response) {
            loggerScope.error('No response from page.goto', {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'workers',
              data: {
                response: response,
              },
            });

            throw new Error('No response from page.goto');
          }

          if (!response.ok()) {
            loggerScope.error('Navigation failed', {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'workers',
              stage: 'process',
              status: response.status(),
              data: {
                responseStatusText: response.statusText(),
              },
            });

            throw new Error(`Navigation failed: ${response.status()} ${response.statusText()}`);
          }

          loggerScope.debug('Response from  page.goto  succeeded', {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'workers',
            status: response.status(),
            data: {
              response: response,
            },
          });

          const headers = this.buildHeaders(url_init);
          if (!headers || typeof headers !== 'object') {
            loggerScope.error('Headers are invalid', {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'workers',
              data: {
                headers: headers,
              },
            });

            throw new Error('Headers are invalid');
          }

          const request = context.request;
          if (!context.request) {
            loggerScope.error('APIRequestContext is undefined', {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'workers',
              data: {
                request: context.request,
              },
            });

            throw new Error('APIRequestContext is undefined');
          }

          try {
            const result = (await source.workerHttpRequest(
              request,
              headers,
              targetUrl,
              limiter,
              getNext,
              {
                brand_name: task.brand_name,
              },
            )) as IHttpResult<IAutocompleteResponse>[];

            loggerScope.debug('source.workerHttpRequest() succeed', {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'source.workerHttpRequest(...)',
              stage: 'finish',
              data: {
                result: result,
              },
            });

            for (const r of result) {
              if (!r.ok || !r.body) {
                loggerScope.error('One of the results from source.workerHttpRequest() is invalid', {
                  component: 'RozetkaScenario',
                  method: 'process',
                  action: 'for (const r of result)',
                  stage: 'start',
                  data: {
                    result: r,
                  },
                });

                throw new Error(
                  `One of the results from source.workerHttpRequest() is invalid  ${r}`,
                );
              }

              for (const g of r.body.data.content.records.goods) {
                if (!this.isValidGoodsItem(g)) {
                  loggerScope.debug(
                    'Missing or invalid goods in one of the workerHttpRequest results',
                    {
                      component: 'RozetkaScenario',
                      method: 'process',
                      action: 'for (const g of r.body.data.content.records.goods)',
                      data: {
                        sku: r.body.data.content.text,
                      },
                    },
                  );
                  continue;
                }

                loggerScope.debug('Started processing product', {
                  component: 'RozetkaScenario',
                  method: 'process',
                  action: 'for (const g of r.body.data.content.records.goods)',
                  stage: 'start',
                  data: {
                    sku: r.body.data.content.text,
                    currentProduct: g,
                  },
                });

                if (g.title.includes(r.body.data.content.text)) {
                  productsPageLinks[r.body.data.content.text] ??= [];
                  productsPageLinks[r.body.data.content.text].push(g.href);

                  loggerScope.debug('Product contains required SKU in the title', {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'if (g.title.includes(r.body.data.content.text))',
                    data: {
                      sku: r.body.data.content.text,
                      currentProduct: g,
                    },
                  });

                  const result = await source.worker(
                    g.href,
                    page,
                    limiter,
                    undefined,
                    r.body.data.content.text,

                    { brand_name: task.brand_name },
                  );

                  //!!!!!!!!!!!!!!!
                  //todo при удачном сборе фото для данного sku нужно удалять этот товар из файла не обработанных товаров
                  //!!!!!!!!!!!!!!!

                  for (const r of result) {
                    for (const [sku, images] of Object.entries(r.data)) {
                      allData[sku] ??= [];
                      allData[sku].push(...images);
                    }

                    if (Array.isArray(r.errors)) {
                      for (const err of r.errors) {
                        try {
                          //!!!!!!!!!!!!!!!!!!!!
                          //todo убрать хард код 1 !!
                          //!!   https://chatgpt.com/c/699c4f03-0890-832d-b585-ddb400ac1c4d  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                          await this.handleError(err, 1, {
                            sku: '',
                            loggerScope: loggerScope,
                            debugMeta: {},
                          });
                        } catch (finalErr) {
                          errors.push({
                            item: err.product,
                            error: finalErr as IWorkerError,
                          });
                        }
                      }
                    }
                  }
                } else {
                }
              }
            }
          } catch (error) {
            loggerScope.error('source.workerHttpRequest()  failed', {
              component: 'RozetkaScenario',
              method: 'process',
              action: 'Array.from({ length: quantityPage }, async () => {...}',
              data: {
                errorName: error instanceof Error ? error.name : undefined,
                errorMessage: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
            });

            errors.push({
              item: undefined as any,
              error: error as IWorkerError,
            });
          } finally {
            pool.release(page);
          }
        });

        await Promise.allSettled(workers);
        return errors;
      };

      let attempt = 1;
      let currentBatch = taskQueue;

      while (currentBatch.length && attempt <= this.maxRetries) {
        // todo выбрать какую то одну
        // await limiter.sleepNormal(1000, 5000);
        await limiter.sleep(1000, 5000);

        loggerScope?.debug(`Search URL for  ${task.brand_name}  attempt № ${attempt}`, {
          component: 'PageImageSourceRozetka',
          method: 'process',
          action: ' while (currentBatch.length && attempt <= this.maxRetries)',
          stage: 'start',
          data: {
            batchSize: currentBatch.length,
            currentBatch: currentBatch,
          },
        });

        const errors = await runBatch(currentBatch);

        const retryable = errors.filter(
          (e): e is { item: IProduct; error: IWorkerError } =>
            !!e.item && attempt < this.maxRetries && isRetryable(e.error),
        );

        currentBatch = retryable.map((e) => e.item);
        loggerScope?.debug(`Received a new currentBatch`, {
          component: 'PageImageSourceRozetka',
          method: 'process',
          action: 'retryable.map((e) => e.item)',
          data: {
            attempt: attempt,
            batchSize: currentBatch.length,
            currentBatch: currentBatch,
          },
        });

        if (currentBatch.length) {
          await waitBeforeRetry(attempt);
        } else {
          // оставшиеся ошибки записываем в глобальный пул ошибок
          errors.forEach((e) => {
            allErrors.push({
              error: e.error,
              targetUrl: targetUrl ?? undefined,
            });
          });
        }

        attempt++;
      }

      console.log(`All workers finished  for ${task.brand_name}`);
      console.log('productsPageLinks = ', productsPageLinks);

      const allDataNormalize = normalizeAllData(allData);
      console.log('allDataNormalize = ');
      console.dir(allDataNormalize, { depth: null, colors: true });

      console.log(`allErrors SearchURL  for ${task.brand_name}   = `);
      console.dir(allErrors, { depth: null, colors: true });

      /* Скачиваю полученные urls  */

      let imageQueue: IImageItem[] = [];
      for (const [sku, urls] of Object.entries(allDataNormalize)) {
        urls.forEach((url, i) => {
          imageQueue.push({ sku, url, index: i + 1 });
        });
      }

      const processImage = async (page: Page, item: IImageItem): Promise<void> => {
        const { sku, url, index } = item;
        const { buffer, ext } = await limiter.schedule(() => this.browser.download(page, url));
        const filename = `${task.brand_name}_${sku}_${index}__R__${ext}`;

        await this.storage.save({
          filename,
          buffer,
          targetDir: path.join(task.brand_name, sku),
        });
      };

      const runBatchImage = async (items: IImageItem[]): Promise<IImageError[]> => {
        const errors: IImageError[] = [];
        const queue = [...items];

        const workers = Array.from({ length: quantityPage }, async () => {
          const page = await pool.acquire();

          try {
            while (true) {
              const item = queue.shift();
              if (!item) return;

              try {
                await processImage(page, item);
              } catch (error) {
                errors.push({ item, error: error as IWorkerError });
              }
            }
          } finally {
            pool.release(page);
          }
        });

        await Promise.allSettled(workers);
        return errors;
      };

      // todo должна быть централизованная обработка ошибок в методе handleError
      const procError = (errors: IImageError[], attempt: number): IImageError[] => {
        return errors.filter((e) => attempt < this.maxRetries && isRetryable(e.error));
      };

      let attemptImage = 1;
      let currentBatchImage = imageQueue;

      while (currentBatchImage.length && attemptImage <= this.maxRetries) {
        console.log(`---> DownloadImage  for ${task.brand_name}   attempt №`, attemptImage);

        const errors = await runBatchImage(currentBatchImage);

        console.log(`errors of DownloadImage  for ${task.brand_name}  = `);
        console.dir(errors, { depth: null, colors: true });

        // Отбираем retryable
        const retryable = procError(errors, attemptImage);
        currentBatchImage = retryable.map((e) => e.item);

        if (currentBatchImage.length) {
          await waitBeforeRetry(attemptImage);
        } else {
          // Сохраняем окончательные ошибки
          errors.forEach((e) => {
            allErrors.push({
              error: e.error,
              targetUrl: e.item.url,
            });
          });
        }

        attemptImage++;
      }
    }, 'fake');

    console.log(`All workers finished  for ${task.brand_name}`);

    const allDataNormalize = normalizeAllData(allData);
    console.log('allDataNormalize = ');

    console.dir(allDataNormalize, { depth: null, colors: true });

    console.log(`allErrors SearchURL  for ${task.brand_name}   = `);
    console.dir(allErrors, { depth: null, colors: true });

    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    // await limiter.sleep(1000, 5000);

    // const productsPageLinks = {
    //   '1865231': ['https://rozetka.com.ua/ua/columbia_0990037254005_0192660465388/p388246605/'],
    //   '2079181': ['https://rozetka.com.ua/ua/columbia-195981582994/p446003411/'],
    //   '2103761': ['https://rozetka.com.ua/ua/columbia-195981625394/p446018603/'],
    // };
    // console.log('========================   productsPageLinks = ', productsPageLinks);

    // await this.browser.runInContext(async context => {
    // await this.browser.runInContextByChromium(async context => {
    //   /*Хожу по полученным страницам товаров */ //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    //   type IProductLinkItem = {
    //     sku: string;
    //     link: string;
    //   };

    //   type IProdPageError = {
    //     item?: IProductLinkItem;
    //     error: IWorkerError;
    //   };

    //   const uniqueProducts = Object.entries(productsPageLinks).map(([sku, links]) => ({
    //     sku,
    //     links,
    //   }));
    //   const queue = [...uniqueProducts];
    //   const limiter = new RateLimiter(5000);

    //   const taskQueueProdPage: IProductLinkItem[] = [];

    //   for (const [sku, links] of Object.entries(productsPageLinks)) {
    //     for (const link of links) {
    //       taskQueueProdPage.push({ sku, link });
    //     }
    //   }

    //   const runBatchProdPage = async (items: IProductLinkItem[]): Promise<IProdPageError[]> => {
    //     const errors: IProdPageError[] = [];
    //     let index = 0;

    //     const quantityPage = Math.min(queue.length, this.maxPage);
    //     const pool = new PagePool(context, quantityPage);
    //     this.registerResource(pool);

    //     const getNext = (): IProductLinkItem | undefined => {
    //       if (index >= items.length) return undefined;
    //       return items[index++];
    //     };

    //     const workers = Array.from({ length: quantityPage }, async () => {
    //       const page = await pool.acquire();

    //       try {
    //         while (true) {
    //           const item = getNext();
    //           if (!item) break;

    //           try {
    //             const result = await source.worker(item.link, page, limiter, undefined, item.sku);

    //             for (const r of result) {
    //               for (const [sku, images] of Object.entries(r.data)) {
    //                 allData[sku] ??= [];
    //                 allData[sku].push(...images);
    //               }

    //               if (Array.isArray(r.errors)) {
    //                 for (const err of r.errors) {
    //                   try {
    //                     await this.handleError(err);
    //                   } catch (finalErr) {
    //                     errors.push({
    //                       item: { sku: item.sku } as any,
    //                       error: finalErr as IWorkerError,
    //                     });
    //                   }
    //                 }
    //               }
    //             }
    //           } catch (err) {
    //             errors.push({
    //               item: { sku: item.sku } as any,
    //               error: err as IWorkerError,
    //             });
    //           }
    //         }
    //       } finally {
    //         pool.release(page);
    //       }
    //     });

    //     await Promise.allSettled(workers);
    //     return errors;
    //   };

    //   let attemptProdPage = 1;
    //   let currentBatchProdPage = taskQueueProdPage;

    //   while (currentBatchProdPage.length && attemptProdPage <= this.maxRetries) {
    //     console.log(`---> CollectImages for ${task.brand_name} attemptProdPage №`, attemptProdPage);

    //     await limiter.sleep(1000, 5000);

    //     const errors = await runBatchProdPage(currentBatchProdPage);

    //     const retryable = errors.filter(
    //       (e): e is { item: IProductLinkItem; error: IWorkerError } =>
    //         !!e.item && attemptProdPage < this.maxRetries && isRetryable(e.error),
    //     );

    //     currentBatchProdPage = retryable.map(e => e.item);

    //     if (currentBatchProdPage.length) {
    //       await waitBeforeRetry(attemptProdPage);
    //     } else {
    //       errors.forEach(e => {
    //         allErrors.push({
    //           error: e.error,
    //           targetUrl: undefined,
    //         });
    //       });
    //     }

    //     attemptProdPage++;
    //   }

    //   console.log('****** allData = ', allData);
    // }, 'fake');

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

  isValidGoodsItem(value: unknown): value is { title: string; href: string } {
    if (typeof value !== 'object' || value === null) return false;

    const v = value as Record<string, unknown>;

    return typeof v.title === 'string' && typeof v.href === 'string';
  }
}
