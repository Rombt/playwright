import { IBrowser } from "../browser/IBrowser";
// import { ImageResult } from "../contracts/ImageResult";
import { ITask } from "../data/entities/ITask";
import { BrowserContext } from "playwright";

export interface ISource<T extends ITask, R = unknown> {
  supports(task: T): boolean;

  execute(
    task: T,
    context: BrowserContext
  ): Promise<R>;
}