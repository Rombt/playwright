import { IScenario } from "../IScenario";
import { ISource } from "../../source/ISource";
import { Storage } from "../../storage/Storage";
import { IBrowser } from "../../browser/IBrowser";
import { ICollectProductPhotosTask } from "../../data/entities/ITasks/ICollectProductPhotosTask";

import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { BrowserContext } from "playwright";

import { PlaywrightPageAdapter as PageAdapter } from "../../browser/playwright/PlaywrightPageAdapter";
import  PageImageSource  from "../../source/sources/PageImageSource";
import { RateLimiter } from "../../browser/limiter/RateLimiter";
import { PagePool } from "../../browser/pool/PagePool";





export class DefaultScenario<
  IPhotosTask extends ICollectProductPhotosTask,
  Browser,
  Context extends BrowserContext
> implements IScenario<IPhotosTask, Browser, Context> {

  private readonly maxRetries = 10;
  private readonly baseDelay = 500;
  private readonly maxDelay = 5000;

  private readonly sourcesFolder:string = './dist/source/sources';
  private readonly taskPath:string = 'src/data/tasks/2026-01-20_14-44.json';

  private sources: ISource<ICollectProductPhotosTask>[] = [];


  constructor(
    private browser: IBrowser<Browser,Context>,
    private storage: Storage
  ) { }
  finalize(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async run(): Promise<void> {
    try {
      const arrTasks = await this.load();
      await this.prepare();
      await this.process(arrTasks);
    } catch (error) {
      await this.handleError(error);
    } finally {
      // await this.finalize();
    }
  }

  async load(): Promise<IPhotosTask[]> {

    //todo получаем массив путей к файлам перебираем формируем массив задач
    const arrTasks = [];

    const filePath = path.resolve(
      process.cwd(),
      this.taskPath
    );

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

      const result = await this.browser.runInContext(async (context) => {
        const page = await PageAdapter.create(context);

        // console.dir(task, { depth: null, colors: true });

        const brand = this.getBrands(task)[0];
        const target_website = brand.metadata.target_website;
        const products = brand.products;

        const source = new PageImageSource();
        const limiter = new RateLimiter(1000);
        const pool = new PagePool(context, 5);

        const queue = [...products];
        let index = 0;
        const getNext = () => {
          if (index >= queue.length) return undefined;
          return queue[index++];
        };


        async function runWorker() {
          const page = await pool.acquire();

          try {
            await source.worker(page, limiter, getNext);
          } finally {
            pool.release(page);
          }
        }
        const workers = Array.from({ length: 5 }, () => runWorker());
        await Promise.allSettled(workers);


        //!!!!!!
        // try {

        //   // await page.goto('https://google.com');

        // } catch (err) {
        //   await this.handleError(err);
        // }



      });

      // await this.storage.save(result);

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

  async handleError(error: unknown, attempt: number = 1): Promise<void> {

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


  protected isRetryable(error: unknown): boolean {
    if (!error) return false;

    // Если это ошибка Playwright с кодом timeout
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      // таймауты и network glitches
      if (msg.includes("timeout") || msg.includes("net::")) return true;

      // если страница динамическая
      if (msg.includes("element not found") || msg.includes("not visible")) return true;
    }

    if ((error as any)?.retryable === true) return true;

    return false;
  }

  protected async waitBeforeRetry(attempt: number): Promise<void> {
    const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

}