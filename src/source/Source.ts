import { IBrowser } from "../browser/IBrowser";
// import { ImageResult } from "../contracts/ImageResult";
import { ITask } from "../Task/ITask";

export interface Source<T extends ITask> {
  // collect(task: ITask, browser: IBrowser<unknown, unknown>): Promise<ImageResult[]>;
}