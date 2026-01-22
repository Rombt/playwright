import { IBrowser } from "../browser/IBrowser";
import { ImageResult } from "../contracts/ImageResult";
import { Task } from "../contracts/Task";

export interface Source {
  collect(task: Task, browser: IBrowser<unknown, unknown>): Promise<ImageResult[]>;
}