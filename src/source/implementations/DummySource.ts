import { Source } from "../Source";
import { Browser } from "../../browser/Browser";
import { Task } from "../../contracts/Task";
import { ImageResult } from "../../contracts/ImageResult";

export class DummySource implements Source {
  async collect(task: Task, browser: Browser): Promise<ImageResult[]> {
    console.log("Collect for", task.sku);
    return [];
  }
}