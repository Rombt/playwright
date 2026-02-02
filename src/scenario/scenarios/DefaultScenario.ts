import { IScenario } from '../IScenario';
import { ISource } from '../../source/ISource';
import { Storage } from '../../storage/Storage';
import { IBrowser } from '../../browser/IBrowser';
import { ICollectProductPhotosTask } from '../../data/entities/ITasks/ICollectProductPhotosTask';
import { IWorkerError } from '../../data/entities/IErrors/IWorkerError';
import { IWorkerResult } from '../../data/entities/IResults/IWorkerResult';
import { IDownloadedFile } from '../../browser/IDownloadedFile';
import { IDataImag } from '../../data/entities/IDataImag';
import { IBrand } from '../../data/entities/IBrand';

import { promises as fs } from 'fs';
import * as path from 'path';

import { BrowserContext } from 'playwright-core';

import PageImageSource from '../../source/sources/PageImageSource';
import { RateLimiter } from '../../browser/limiter/RateLimiter';
import { PagePool } from '../../browser/pool/PagePool';

// import { ImageResult } from "../../contracts/ImageResult";

export class DefaultScenario<
  IPhotosTask extends ICollectProductPhotosTask,
  Browser,
  Context extends BrowserContext,
> implements IScenario<IPhotosTask, Browser, Context>
{
  private readonly maxRetries: number = 3;
  private readonly baseDelay: number = 500;
  private readonly maxDelay: number = 5000;
  private readonly maxPage: number = 10;

  private readonly sourcesFolder: string = './dist/source/sources';
  private readonly taskPath: string = 'src/data/tasks/2026-01-20_14-44.json';

  private sources: ISource<ICollectProductPhotosTask>[] = [];

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: Storage,
  ) {}

  finalize(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async run(): Promise<void> {
    try {
      const arrTasks = await this.load();
      await this.prepare();
      await this.process(arrTasks);
    } catch (error) {
      console.log('***** error = ', error);
      // await this.handleError(error);   //todo какие ошибки здесь ловить
    } finally {
      // await this.finalize();     //todo
    }
  }

  async load(): Promise<IPhotosTask[]> {
    //todo получаем массив путей к файлам перебираем формируем массив задач
    const arrTasks = [];

    const filePath = path.resolve(process.cwd(), this.taskPath);

    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);

    arrTasks.push(data);

    if (!Array.isArray(arrTasks)) {
      throw new Error('Task file must contain an array');
    }

    return arrTasks as IPhotosTask[];
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(arrTasks: IPhotosTask[]): Promise<void> {
    for (const task of arrTasks) {
      const source = this.sources.find(s => s.supports(task));
      if (!source) throw new Error();

      await this.browser.runInContext(async context => {
        const allErrors: IWorkerError[] = [];
        const allData: IDataImag = {};

        const brand: IBrand = this.getBrands(task)[0];

        const targetUrl = brand.metadata.target_website;
        const products = brand.products;
        const uniqueProducts = Array.from(new Map(products.map(p => [p.sku, p])).values());
        const queue = [...uniqueProducts];

        const source = new PageImageSource();
        const limiter = new RateLimiter(2000);
        const quantityPage = Math.min(queue.length, this.maxPage);
        const pool = new PagePool(context, quantityPage);

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

                // Всё прошло успешно
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

        const imageQueue: { sku: string; url: string }[] = [];
        for (const [sku, urls] of Object.entries(allData)) {
          for (const url of urls) {
            imageQueue.push({ sku, url });
          }
        }

        const runImageWorker = async (): Promise<void> => {
          const page = await pool.acquire();

          try {
            while (true) {
              const task = imageQueue.shift();
              if (!task) return;
              const { sku, url } = task;
              const { filename, buffer } = await limiter.schedule(() =>
                this.browser.download(page, url),
              );

              await this.storage.save({
                filename,
                buffer,
                targetDir: path.join(brand.brand_name, sku),
              });
            }
          } finally {
            pool.release(page);
          }
        };

        const workersDownload = Array.from({ length: quantityPage }, () => runImageWorker());
        await Promise.allSettled(workersDownload);

        //todo перебрать ошибки и сформировать файл с товарами которые не были обработаны
      });
    }
  }

  async loadSources(): Promise<ISource<IPhotosTask, unknown>[]> {
    const files = await fs.readdir(this.sourcesFolder);
    const sources: ISource<IPhotosTask>[] = [];

    for (const file of files) {
      if (!file.endsWith('.js')) continue;

      const fullPath = path.resolve(this.sourcesFolder, file);

      const sourceModule = require(fullPath);

      const SourceClass = sourceModule.default ?? sourceModule;
      sources.push(new SourceClass());
    }

    return sources;
  }

  // async finalize(): Promise<void> {
  //       if (this.pageAdapter) {
  //       await this.pageAdapter.close();
  //   }
  //   if (this.browserContext) {
  //       await this.browserContext.close();
  //   }
  //   this.isInitialized = false;
  // }

  async handleError(error: IWorkerError, attempt: number = 1): Promise<void> {
    console.error(`Error on attempt ${attempt}:`, error);

    if (attempt < this.maxRetries && this.isRetryable(error)) {
      await this.waitBeforeRetry(attempt);
      return this.handleError(error, attempt + 1);
    }

    throw error;
  }

  // =================  helpers ============================
  protected getBrands(task: IPhotosTask) {
    return Object.values(task.task);
  }

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
