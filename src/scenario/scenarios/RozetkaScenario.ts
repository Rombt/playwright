import { BrowserContext, Page } from 'playwright-core';
import { promises as fs } from 'fs';
import * as path from 'path';
import { IScenario } from '../IScenario';
import { ISource } from '../../source/ISource';
import { Storage } from '../../storage/Storage';
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

    const source = this.sources.find((s) => s.supports(task)) as
      | ISource<ICollectProductPhotosTask, IAutocompleteResponse>
      | undefined;
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
    await this.browser.runInContextByChromium(async (context) => {
      //!!==================================================================================================!!
      type TaskResult =
        | { status: 'success'; sku: string }
        | { status: 'retry'; sku: string; error: IWorkerError }
        | { status: 'fatal'; sku: string; error: IWorkerError };

      //========================    Основной код сценария    ========================
      const url_init = 'https://rozetka.com.ua/';
      const targetUrl =
        'https://search.rozetka.com.ua/ua/search/api/v7/autocomplete/?country=UA&lang=ua&text=';

      const products = task.products;

      if (!Array.isArray(products) || products.length === 0) {
        loggerScope.error('Products are absent', {
          component: 'RozetkaScenario',
          method: 'process',
          stage: 'init',
          data: { task },
        });
        throw new Error('Products are absent');
      }

      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());

      let taskQueue: string[] = uniqueProducts.map((p) => p.sku);

      const quantityPage = Math.min(taskQueue.length, this.maxPage);

      const pool = new PagePool(context, quantityPage);
      this.registerResource(pool);
      //========================    /Основной код сценария    ========================

      //========================    Обработка ОДНОГО SKU    ========================
      const processSku = async (sku: string, page: Page): Promise<TaskResult> => {
        try {
          const headers = this.buildHeaders(url_init);
          if (!headers) {
            throw new Error('Invalid headers');
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
            loggerScope.error('autocomplete is invalid', {
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
            if (!this.isAutocompleteGood(g)) continue;

            if (!g.title.includes(sku)) continue;

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

            for (const r of result) {
              for (const [skuKey, images] of Object.entries(r.data)) {
                allData[skuKey] ??= [];
                allData[skuKey].push(...images);
              }
            }
          }

          return { status: 'success', sku };
        } catch (e) {
          return isRetryable(e as IWorkerError)
            ? { status: 'retry', sku, error: e as IWorkerError }
            : { status: 'fatal', sku, error: e as IWorkerError };
        }
      };
      //========================    /Обработка ОДНОГО SKU    ========================

      //========================   Batch runner (без getNext, без race)     ========================
      async function runBatch(skus: string[]): Promise<TaskResult[]> {
        const queue = [...skus];
        const results: TaskResult[] = [];

        const workers = Array.from({ length: quantityPage }, async () => {
          const page = await pool.acquire();

          try {
            const response = await page.goto(url_init, { waitUntil: 'domcontentloaded' });
            if (!response?.ok()) {
              throw new Error(`Navigation failed: ${response?.status()}`);
            }

            while (queue.length) {
              const sku = queue.shift();
              if (!sku) {
                loggerScope.error(`sku is absent`, {
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
          } finally {
            pool.release(page);
          }
        });

        await Promise.all(workers);
        return results;
      }
      //========================  /Batch runner (без getNext, без race)     ========================

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

        while (true) {
          try {
            return await action();
          } catch (e) {
            if (attempt >= options.maxRetries || !options.isRetryable(e as IWorkerError)) {
              throw e;
            }

            options.onRetry?.(attempt, e);
            await waitBeforeRetry(attempt);
            attempt++;
          }
        }
      }

      //========================  /Retry wrapper (ЕДИНСТВЕННЫЙ)     =======================

      //========================   ГЛАВНЫЙ RETRY ЦИКЛ     ========================
      let attempt = 1;
      let currentBatch = taskQueue;

      while (currentBatch.length && attempt <= this.maxRetries) {
        await limiter.sleep(1000, 5000);

        const results: TaskResult[] = await runBatch.call(this, currentBatch);

        const retryResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry',
        );

        const fatalResults = results.filter(
          (r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal',
        );

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
      //!!==================================================================================================!!
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
