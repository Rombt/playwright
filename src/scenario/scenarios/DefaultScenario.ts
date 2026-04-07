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

import { normalizeAllData, getRetryStatus, waitBeforeRetry } from '../../common/helpers';

import { Logger } from '../../data/logger/Logger';
import { IScopedLogger } from '../../data/logger/types/IScopedLogger';
import { ILogger } from '../../data/logger/types/ILogger';
import { SharpImageProcessor as ImageProcessor } from '../../processing/ImageProcessor/SharpImageProcessor';

import { HtmlProcessorFactory, Site } from '../../processing/HTMLProcessor';
import { IProductRaw, IProductRawContent } from '../../processing/HTMLProcessor';
import { UnprocessedCollector } from '../../data/collectors/UnprocessedCollector';

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
      await this.prepare();

      await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));

      await this.retryUnprocessed(brands);
    } catch (error) {
      await this.handleError(error);
    } finally {
      await this.finalize();
    }
  }

  async load(brands?: string[]): Promise<ICollectProductPhotosTask[]> {
    const filePath = path.resolve(process.cwd(), this.taskPath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const data: ICollectProductPhotosBatch = JSON.parse(raw);

    let tasks = Object.values(data.task);

    if (brands?.length) {
      tasks = tasks.filter((t) => brands.includes(t.brand_name));
    }

    return tasks;
  }

  async prepare(): Promise<void> {
    this.sources = await this.loadSources();
  }

  async process(task: ICollectProductPhotosTask, loggerScope?: ILogger): Promise<void> {
    const allErrors: any[] = [];
    const allProductRaw: IProductRaw[] = [];
    const allData: IDataImag = {};

    const source = this.sources.find((s) => s.supports(task));
    if (!source) throw new Error('Source not found');

    await this.browser.runInContextByChromium(async (context) => {
      const products = task.products;
      if (!products?.length) throw new Error('Products are absent');

      const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
      const pool = new PagePool(context, Math.min(uniqueProducts.length, this.maxPage));

      const processProduct = async (product: IProduct) => {
        let page: Page | undefined;

        try {
          page = await pool.acquire();

          const result = await this.withRetry(() =>
            source.worker(task.metadata.target_website!, page!, this.limiter, product, loggerScope),
          );

          let hasImages = false;
          let hasHtml = false;

          for (const r of result) {
            if (r.data.images) {
              hasImages = true;

              for (const [sku, images] of Object.entries(r.data.images)) {
                if (!allData[sku]) {
                  const arr = [] as unknown as IDataImagItem;
                  arr.idProduct = images.idProduct;
                  allData[sku] = arr;
                }
                allData[sku].push(...images);
              }
            }

            if (r.data.html) {
              hasHtml = true;

              const processor = new HtmlProcessorFactory().create(task.brand_name.toLowerCase());
              const raw = processor.process(r.data.html);

              let content: IProductRawContent;

              if (Array.isArray(raw)) {
                // здесь обработка атрибутов примерно так:
                // конвертируем атрибуты в HTML (или строку)
                const attributesHtml = raw
                  .map((a) => `<li><b>${a.name}:</b> ${a.value}</li>`)
                  .join('');

                content = {
                  attributesHtml: `<ul>${attributesHtml}</ul>`,
                };
              } else {
                content = raw;
              }

              allProductRaw.push({
                sku: product.sku,
                id: product.id_product,
                content,
              });
            }
          }

          if (!hasImages || !hasHtml) {
            throw new Error('Incomplete data');
          }
        } catch (err) {
          const workerError = this.normalizeError(err);
          const status = getRetryStatus(workerError);

          allErrors.push({
            ...workerError,
            product,
            targetUrl: task.metadata.target_website,
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

  private async downloadImages(
    urlsBySku: Record<string, string[]>,
    task: ICollectProductPhotosTask,
    context: BrowserContext,
    loggerScope?: ILogger,
  ): Promise<any[]> {
    const errors: any[] = [];
    const pool = new PagePool(context, this.maxPageDownloadImg);

    const queue: IImageItem[] = [];
    for (const [sku, urls] of Object.entries(urlsBySku)) {
      urls.forEach((url, i) => queue.push({ sku, url, index: i + 1 } as IImageItem));
    }

    const worker = async (item: IImageItem) => {
      let page: Page | undefined;

      try {
        page = await pool.acquire();

        const { buffer, ext } = await this.withRetry(() =>
          this.browser.downloadWithFallback(item.url, page!, context, loggerScope),
        );

        this.logger.debug('downloadImages', { item });

        await this.storage.save({
          filename: `${item.sku}_${item.index}${ext}`, //!!!!!  добавить id product  !!!
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

  private async withRetry<T>(action: () => Promise<T>): Promise<T> {
    return await action();
  }

  async retryUnprocessed(brands?: string[]): Promise<void> {
    const collector = new UnprocessedCollector();
    const tasks = collector
      .getPhotoCollectionTasks(this.mode)
      .filter((t: any) => t.status !== 'fatal');

    if (!tasks.length) return;

    await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
  }

  async handleError(error: unknown): Promise<void> {
    this.logger.error('Scenario error', { error });
  }

  async finalize(): Promise<void> {
    for (const res of this.resources) {
      await res.close().catch(() => {});
    }
    this.browser.close();
  }

  async loadSources(): Promise<ISource<ICollectProductPhotosTask>[]> {
    const sources: ISource<ICollectProductPhotosTask>[] = [];

    const walk = async (dir: string) => {
      const files = await fs.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.resolve(dir, file.name);

        if (file.isDirectory()) await walk(fullPath);
        else if (file.name.endsWith('.js')) {
          const mod = require(fullPath);
          const Cls = mod.default ?? mod;
          sources.push(new Cls());
        }
      }
    };

    await walk(this.sourcesFolder);
    return sources;
  }

  registerResource(res: IResource): void {
    this.resources.push(res);
  }

  private async runWithWorkerPool(
    tasks: ICollectProductPhotosTask[],
    handler: (task: ICollectProductPhotosTask, loggerScope?: ILogger) => Promise<void>,
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
}
