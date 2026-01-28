import { ISource } from "../ISource";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../data/entities/ITask";
import { BrowserContext } from "playwright-core";
// import { ImageResult } from "../../contracts/ImageResult";

export default  class DummySource implements ISource<ITask> {
  supports(task: ITask): boolean {

    return false;
  }
  execute(task: ITask, context: BrowserContext): Promise<unknown> {

    throw new Error("Method not implemented.");
  }
  // async collect(task: Task, browser: IBrowser<unknown, unknown>): Promise<ImageResult[]> {
  //   console.log("Collect for", task.sku);
  //   return [];
  // }
}