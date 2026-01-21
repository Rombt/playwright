import { Browser } from "../browser/Browser";
import { ImageResult } from "../contracts/ImageResult";
import { Task } from "../contracts/Task";

export interface Source {
  collect(task: Task, browser: Browser): Promise<ImageResult[]>;
}