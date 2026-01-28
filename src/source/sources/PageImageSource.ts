import { ISource } from "../ISource";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";
import { BrowserContext } from "playwright-core";
// import { ImageResult } from "../../contracts/ImageResult";

export default class PageImageSource implements ISource<ITask> {
  supports(task: ITask): boolean {
    return task.type === 'collect_product_photos';
  }

  execute(task: ITask, context: BrowserContext): Promise<unknown> {
    throw new Error("Method not implemented.");
  }
  // async collect(task: ITask, browser: IBrowser<unknown, unknown>): Promise<unknown> {
  //   // if (!task.sku) return [];

  //   // Получаем HTML (можно использовать для анализа)
  //   // const html = await browser.getHtml();

  //   // Простейший поиск картинок: img[src]
  //   // const results: ImageResult[] = [];
  //   // const imgSelector = "img"; // минимальный пример
  //   // const hasImages = await browser.find(imgSelector);
  //   // if (hasImages) {
  //   //   // Для примера: просто достаем один атрибут src
  //   //   const src = await browser.getAttribute(imgSelector, "src");
  //   //   if (src) {
  //   //     results.push({
  //   //       sku: task.sku,
  //   //       url: src,
  //   //       fileName: `${task.sku}.jpg`,
  //   //     });
  //   //   }
  //   // }

  //   // return results;
  // }
}
