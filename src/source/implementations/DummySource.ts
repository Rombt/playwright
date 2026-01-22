import { Source } from "../Source";
import { IBrowser } from "../../browser/IBrowser";
import { Task } from "../../contracts/Task";
import { ImageResult } from "../../contracts/ImageResult";

export class DummySource implements Source {
  async collect(task: Task, browser: IBrowser<unknown, unknown>): Promise<ImageResult[]> {
    console.log("Collect for", task.sku);
    return [];
  }
}