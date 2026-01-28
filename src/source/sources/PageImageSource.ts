import { ISource } from "../ISource";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../data/entities/ITask";
import { BrowserContext } from "playwright-core";
// import { ImageResult } from "../../contracts/ImageResult";

import { RateLimiter } from "../../browser/limiter/RateLimiter";
import { PagePool } from "../../browser/pool/PagePool";

import { PlaywrightPageAdapter as PageAdapter } from "../../browser/playwright/PlaywrightPageAdapter";

export default class PageImageSource implements ISource<ITask> {
  supports(task: ITask): boolean {
    return task.type === 'collect_product_photos';
  }

  execute(task: ITask, context: BrowserContext): Promise<unknown> {
    throw new Error("Method not implemented.");
  }



  // async  worker(
  //   page: PageAdapter,
  //   products: Product[],
  //   limiter: RateLimiter,
  //   getNext: () => Product | undefined
  // ) {
  //   while (true) {
  //     const product = getNext();
  //     if (!product) break;

  //     await limiter.wait();

  //     const url = buildProductUrl(product.sku);
  //     await page.goto(url, { waitUntil: 'domcontentloaded' });

  //     await runScenario(page, product);

  //     // Небольшая "человеческая" пауза
  //     await delay(300 + Math.random() * 400);
  //   }
  // }



}
