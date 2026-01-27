import { Source } from "../Source";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";
// import { ImageResult } from "../../contracts/ImageResult";

export class PageImageSource implements Source<ITask> {
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
