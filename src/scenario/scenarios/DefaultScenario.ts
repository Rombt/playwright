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

export class DefaultScenario<Browser, Context extends BrowserContext>
  implements IScenario<Browser, Context>
{
  private readonly config: AppConfig;
  private readonly maxRetries: number;
  private readonly maxPage: number;
  private readonly maxTask: number;
  private readonly sourcesFolder: string;

  //todo отдельная папка для задач, но сначала интерфейс
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

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: IStorage,
  ) {
    this.config = AppConfig.getInstance();

    this.maxRetries = this.config.asyncRetry.maxRetries;
    this.maxPage = this.config.asyncPages.maxPage;
    this.maxTask = this.config.asyncTasks.maxTask;
    this.sourcesFolder = this.config.sourcesFolder;
  }

  async run(brands?: string[]): Promise<void> {
    try {
      const arrTasks = await this.load(brands);

      console.log('arrTasks = ', arrTasks);
      await this.prepare();

      for (let i = 0; i < arrTasks.length; i += this.maxTask) {
        const batch = arrTasks.slice(i, i + this.maxTask);
        await Promise.all(batch.map((task) => this.process(task)));
      }
    } catch (error) {
      console.log('error in run() = ');
      console.dir(error, { depth: null, colors: true });
      // await this.handleError(error);   //todo какие ошибки здесь ловить??
    } finally {
      await this.finalize();
    }
  }

  async load(brands?: string[]): Promise<ICollectProductPhotosTask[]> {
    const filePath = path.resolve(process.cwd(), this.taskPath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ICollectProductPhotosBatch = JSON.parse(raw);

    const allTasks = Object.values(data.task);

    if (!brands?.length) {
      return allTasks;
    }

    return allTasks.filter((task) => brands.includes(task.brand_name));
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(task: ICollectProductPhotosTask): Promise<void> {
    const source = this.sources.find((s) => s.supports(task));

    if (!source) throw new Error();

    const allErrors: IWorkerError[] = [];
    await this.browser.runInContext(async (context) => {
      const allData: IDataImag = {};

      const targetUrl = task.metadata.target_website;
      const products = task.products;
      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
      const queue = [...uniqueProducts];

      const limiter = new RateLimiter(2000);
      const quantityPage = Math.min(queue.length, this.maxPage);
      const pool = new PagePool(context, quantityPage);
      this.registerResource(pool);

      //todo  Убрать!
      type ITaskError = {
        item?: IProduct;
        error: IWorkerError;
      };

      let taskQueue: IProduct[] = [...queue];

      const runBatch = async (items: IProduct[]): Promise<ITaskError[]> => {
        const errors: ITaskError[] = [];
        let index = 0;

        const getNext = (): IProduct | undefined => {
          if (index >= items.length) return undefined;
          return items[index++];
        };

        const workers = Array.from({ length: quantityPage }, async () => {
          const page = await pool.acquire();

          try {
            const result = await source.worker(targetUrl!, page, limiter, getNext);

            for (const r of result) {
              for (const [sku, images] of Object.entries(r.data)) {
                allData[sku] ??= [];
                allData[sku].push(...images);
              }

              if (Array.isArray(r.errors)) {
                for (const err of r.errors) {
                  try {
                    await this.handleError(err);
                  } catch (finalErr) {
                    errors.push({
                      item: err.product,
                      error: finalErr as IWorkerError,
                    });
                  }
                }
              }
            }
          } catch (err) {
            errors.push({
              item: undefined as any,
              error: err as IWorkerError,
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
        console.log(`---> SearchURL for ${task.brand_name}  attempt №`, attempt);
        // todo выбрать какую то одну
        // await limiter.sleepNormal(1000, 5000);
        await limiter.sleep(1000, 5000);

        const errors = await runBatch(currentBatch);

        const retryable = errors.filter(
          (e): e is { item: IProduct; error: IWorkerError } =>
            !!e.item && attempt < this.maxRetries && isRetryable(e.error),
        );

        currentBatch = retryable.map((e) => e.item);

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

      const allDataNormalize = normalizeAllData(allData);

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
        const filename = `${task.brand_name}_${sku}_${index}${ext}`;

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

        // todo выбрать какую то одну
        // await limiter.sleepNormal(1000, 5000);
        await limiter.sleep(1000, 5000);

        const errors = await runBatchImage(currentBatchImage);

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
    });

    console.log('END allErrors = ');
    console.dir(allErrors, { depth: null, colors: true });

    await this.storage.saveJson(allErrors, {
      filename: `${task.brand_name}_unprocessed-products.json`,
      targetDir: task.brand_name,
    });
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

  async handleError(error: IWorkerError, attempt: number = 1): Promise<void> {
    console.error(`Error on attempt ${attempt}:`, error);

    if (attempt < this.maxRetries && isRetryable(error)) {
      await waitBeforeRetry(attempt);
      return this.handleError(error, attempt + 1);
    }

    throw error;
  }
}
