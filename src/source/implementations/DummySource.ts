import { Source } from "../Source";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";
// import { ImageResult } from "../../contracts/ImageResult";

export class DummySource implements Source<ITask> {
  // async collect(task: Task, browser: IBrowser<unknown, unknown>): Promise<ImageResult[]> {
  //   console.log("Collect for", task.sku);
  //   return [];
  // }
}