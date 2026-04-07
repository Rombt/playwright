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

import { normalizeAllData, getRetryStatus, waitBeforeRetry } from '../../common/helpers';
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
  private readonly maxPage: number;
  private readonly maxTask: number;
  private readonly sourcesFolder: string;
  private readonly logger: Logger;

  private sources: ISource<ICollectProductPhotosTask>[] = [];
  private resources: IResource[] = [];

  constructor(
    private browser: IBrowser<Browser, Context, IDownloadedFile>,
    private storage: IStorage,
    private mode: string,
  ) {
    this.config = AppConfig.getInstance();
    this.logger = Logger.getInstance();

    this.maxPage = this.config.asyncPages.maxPage;
    this.maxTask = this.config.asyncTasks.maxTask;
    this.sourcesFolder = this.config.sourcesFolder;
  }

  async run(): Promise<void> {
    try {
      const tasks = await this.load();

      await this.prepare();

      await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
    } catch (error) {
      await this.handleError(error);
    } finally {
      await this.finalize();
    }
  }

  async load(): Promise<ICollectProductPhotosTask[]> {
    const collector = new UnprocessedCollector();

    return collector.getPhotoCollectionTasks(this.mode).filter((t: any) => t.status !== 'fatal');
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(task: ICollectProductPhotosTask, loggerScope?: ILogger): Promise<void> {
    const source = this.sources.find((s) => s.supports(task));
    if (!source) throw new Error('Source not found');

    const allErrors: any[] = [];
    const allData: IDataImag = {};
    const limiter = new RateLimiter(5000);

    await this.browser.runInContextByChromium(async (context) => {
      const products = task.products;
      if (!products?.length) throw new Error('Products are absent');

      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
      const pool = new PagePool(context, Math.min(uniqueProducts.length, this.maxPage));

      const processProduct = async (product: IProduct) => {
        let page: Page | undefined;

        try {
          page = await pool.acquire();

          const headers = this.buildHeaders('https://rozetka.com.ua/');
          const sku = String(product.sku);

          const autocomplete = await source.workerHttpRequest(
            context.request,
            headers,
            'https://search.rozetka.com.ua/ua/search/api/v7/autocomplete/?country=UA&lang=ua&text=',
            limiter,
            sku,
            { brand_name: task.brand_name },
            loggerScope,
          );

          const body = autocomplete.body as IAutocompleteResponse | null;

          if (!autocomplete.ok || !autocomplete.body) {
            throw new Error('Autocomplete failed');
          }

          let found = false;

          for (const g of body?.data.content.records.goods ?? []) {
            if (!this.isAutocompleteGood(g)) continue;
            if (!g.title.includes(sku)) continue;

            found = true;

            const result = await source.worker(g.href, page, limiter, product, loggerScope);

            for (const r of result) {
              for (const [skuKey, images] of Object.entries(r.data.images ?? {}) as [
                string,
                IDataImagItem,
              ][]) {
                if (!allData[skuKey]) {
                  const arr = [] as unknown as IDataImagItem;
                  arr.idProduct = images.idProduct;
                  allData[skuKey] = arr;
                }

                allData[skuKey].push(...images);
              }
            }
          }

          if (!found) {
            throw new Error('Product not found');
          }
        } catch (err) {
          const workerError = this.normalizeError(err);
          const status = getRetryStatus(workerError);

          allErrors.push({
            ...workerError,
            product,
            status,
          });
        } finally {
          if (page) pool.release(page);
        }
      };

      await Promise.allSettled(uniqueProducts.map(processProduct));

      const normalized = normalizeAllData(allData);

      const imageErrors = await this.downloadImages(normalized, task, context, loggerScope);

      allErrors.push(...imageErrors);
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
    loggerScope?: ILogger,
  ): Promise<any[]> {
    const errors: any[] = [];
    const pool = new PagePool(context, this.maxPage);

    const queue: IImageItem[] = [];

    for (const [sku, urls] of Object.entries(urlsBySku)) {
      urls.forEach((url, i) => {
        queue.push({ sku, url, index: i + 1 } as IImageItem);
      });
    }

    const worker = async (item: IImageItem) => {
      let page: Page | undefined;

      try {
        page = await pool.acquire();

        const { buffer, ext } = await this.browser.downloadStaticResource(
          item.url,
          context,
          loggerScope,
        );

        await this.storage.save({
          filename: `${item.sku}_${item.index}${ext}`,
          buffer,
          targetDir: '',
        });
      } catch (err) {
        const workerError = this.normalizeError(err);
        const status = getRetryStatus(workerError);

        errors.push({
          ...workerError,
          targetUrl: item.url,
          status,
        });
      } finally {
        if (page) pool.release(page);
      }
    };

    await Promise.allSettled(queue.map(worker));

    await this.storage.saveJson(errors, {
      filename: `${task.brand_name}_undownloaded_images.json`,
      targetDir: '',
    });

    return errors;
  }

  async handleError(error: unknown): Promise<void> {
    this.logger.error('RozetkaScenario error', { error });
  }

  async finalize(): Promise<void> {
    for (const res of this.resources) {
      await res.close().catch(() => {});
    }

    this.browser.close();
  }

  async loadSources(): Promise<ISource<ICollectProductPhotosTask>[]> {
    const files = await fs.readdir(this.sourcesFolder);
    const sources: ISource<ICollectProductPhotosTask>[] = [];

    for (const file of files) {
      if (!file.endsWith('.js')) continue;

      const mod = require(path.resolve(this.sourcesFolder, file));
      const Cls = mod.default ?? mod;

      sources.push(new Cls());
    }

    return sources;
  }

  registerResource(res: IResource): void {
    this.resources.push(res);
  }

  private async runWithWorkerPool(
    tasks: ICollectProductPhotosTask[],
    handler: (task: ICollectProductPhotosTask, logger?: ILogger) => Promise<void>,
  ): Promise<void> {
    let index = 0;

    const worker = async () => {
      while (index < tasks.length) {
        const current = tasks[index++];
        await handler(current);
      }
    };

    await Promise.all(Array.from({ length: this.maxTask }, worker));
  }

  private normalizeError(err: unknown): { error: Error } {
    if (err instanceof Error) return { error: err };
    return { error: new Error(String(err)) };
  }

  buildHeaders(refer: string = '') {
    return {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'uk-UA,uk;q=0.9',
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
