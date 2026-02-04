import { BrowserContext } from 'playwright-core';
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

export class DefaultScenario<Browser, Context extends BrowserContext>
  implements IScenario<Browser, Context>
{
  private readonly maxRetries: number = 3;
  private readonly baseDelay: number = 500;
  private readonly maxDelay: number = 5000;
  private readonly maxPage: number = 10; // максимальное количество страниц в пуле
  private readonly maxTask: number = 5; // количество одновременно выполняемых задач

  private readonly sourcesFolder: string = './dist/source/sources';
  private readonly taskPath: string = 'src/data/tasks/2026-02-03_10-52.json';

  private sources: ISource<ICollectProductPhotosTask>[] = [];
  private resources: IResource[] = [];

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: Storage,
  ) {}

  async run(): Promise<void> {
    try {
      const arrTasks = await this.load();
      await this.prepare();

      for (let i = 0; i < arrTasks.length; i += this.maxTask) {
        const batch = arrTasks.slice(i, i + this.maxTask);
        await Promise.all(batch.map(task => this.process(task)));
      }
    } catch (error) {
      console.log('error = ', error);
      // await this.handleError(error);   //todo какие ошибки здесь ловить??
    } finally {
      await this.finalize();
    }
  }

  async load(): Promise<ICollectProductPhotosTask[]> {
    //todo получаем массив путей к файлам перебираем формируем массив задач

    const filePath = path.resolve(process.cwd(), this.taskPath);

    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ICollectProductPhotosBatch = JSON.parse(raw);

    const arrTasks: ICollectProductPhotosTask[] = Object.values(data.task);

    if (!Array.isArray(arrTasks)) {
      throw new Error('Task file must contain an array');
    }

    return arrTasks;
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(task: ICollectProductPhotosTask): Promise<void> {
    const source = this.sources.find(s => s.supports(task));

    if (!source) throw new Error();

    await this.browser.runInContext(async context => {
      const allErrors: IWorkerError[] = [];
      const allData: IDataImag = {};

      const targetUrl = task.metadata.target_website;
      const products = task.products;
      const uniqueProducts = Array.from(new Map(products.map(p => [p.sku, p])).values());
      const queue = [...uniqueProducts];

      const limiter = new RateLimiter(2000);
      const quantityPage = Math.min(queue.length, this.maxPage);
      const pool = new PagePool(context, quantityPage);
      this.registerResource(pool);

      let index = 0;
      const getNext = () => {
        if (index >= queue.length) return undefined;
        return queue[index++];
      };

      // runWorker обрабатывает retry внутри себя
      const runWorker = async (): Promise<unknown[]> => {
        const page = await pool.acquire();

        try {
          if (!targetUrl) {
            const err: IWorkerError = { error: 'URL is missing in metadata' };
            // Если это ретрайable ошибка, handleError сам её повторит
            try {
              await this.handleError(err);
            } catch (finalErr) {
              allErrors.push(finalErr as IWorkerError);
            }
            return [];
          }

          while (true) {
            try {
              // вызываем worker
              const result = await source.worker(targetUrl, page, limiter, getNext);

              for (const r of result as IWorkerResult[]) {
                for (const [sku, images] of Object.entries(r.data) as [string, string[]][]) {
                  allData[sku] ??= [];
                  allData[sku].push(...images);
                }
              }

              // если в результате есть ошибки, обрабатываем их через handleError
              if (Array.isArray(result)) {
                for (const item of result as IWorkerResult[]) {
                  if (item && Array.isArray(item.errors)) {
                    for (const err of item.errors) {
                      try {
                        // err уже имеет тип IWorkerError, можно передавать напрямую
                        await this.handleError(err);
                      } catch (finalErr) {
                        allErrors.push(finalErr as IWorkerError);
                      }
                    }
                  }
                }
              }

              return result;
            } catch (err) {
              // Любая ошибка worker
              try {
                await this.handleError({ error: err });
              } catch (finalErr) {
                allErrors.push(finalErr as IWorkerError);
                return [];
              }
            }
          }
        } finally {
          pool.release(page);
        }
      };

      const workers = Array.from({ length: quantityPage }, () => runWorker());
      const results = await Promise.allSettled(workers);

      console.log('All workers finished.');

      const imageQueue: { sku: string; url: string; index: number }[] = [];
      for (const [sku, urls] of Object.entries(allData)) {
        urls.forEach((url, i) => {
          imageQueue.push({ sku, url, index: i + 1 });
        });
      }

      const runImageWorker = async (): Promise<void> => {
        const page = await pool.acquire();

        try {
          while (true) {
            const currentTask = imageQueue.shift();

            if (!currentTask) return;

            const { sku, url, index } = currentTask;
            let { buffer, ext } = await limiter.schedule(() => this.browser.download(page, url));
            const filename = `${task.brand_name}_${sku}_${index}${ext}`;

            console.log('===> sku = ', sku);
            console.log('index = ', index);
            console.log('filename = ', filename);

            await this.storage.save({
              filename,
              buffer,
              targetDir: path.join(task.brand_name, sku),
            });
          }
        } finally {
          pool.release(page);
        }
      };

      const workersDownload = Array.from({ length: quantityPage }, () => runImageWorker());
      await Promise.allSettled(workersDownload);

      const unprocessedProducts = this.getUnprocessedProducts(allErrors);

      await this.storage.saveJson(unprocessedProducts, {
        filename: 'unprocessed-products.json',
        targetDir: task.brand_name,
      });
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

  async handleError(error: IWorkerError, attempt: number = 1): Promise<void> {
    console.error(`Error on attempt ${attempt}:`, error);

    if (attempt < this.maxRetries && this.isRetryable(error)) {
      await this.waitBeforeRetry(attempt);
      return this.handleError(error, attempt + 1);
    }

    throw error;
  }

  registerResource(res: IResource): void {
    this.resources.push(res);
  }

  getUnprocessedProducts(errors: IWorkerError[]): IProduct[] {
    const unprocessedProducts = Array.from(
      new Map(errors.filter(e => e.product).map(e => [e.product!.id_product, e.product!])).values(),
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

  // =================  helpers ============================

  protected isRetryable(error: IWorkerError): boolean {
    if (!error) return false;

    // Если это ошибка Playwright с кодом timeout
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      // таймауты и network glitches
      if (msg.includes('timeout') || msg.includes('net::')) return true;

      // если страница динамическая
      if (msg.includes('element not found') || msg.includes('not visible')) return true;
    }

    if ((error as any)?.retryable === true) return true;

    return false;
  }

  protected async waitBeforeRetry(attempt: number): Promise<void> {
    const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}
