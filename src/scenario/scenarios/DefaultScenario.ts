import { IScenario } from "../IScenario";
import { Source } from "../../source/Source";
import { Storage } from "../../storage/Storage";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";

export class DefaultScenario<T extends ITask, Browser,Context> implements IScenario<T, Browser, Context> {
  constructor(
    private source: Source<T>,
    private browser: IBrowser<Browser,Context>,
    private storage: Storage
  ) {}
  run(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  load(): Promise<T[]> {
    throw new Error("Method not implemented.");
  }
  prepare(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  process(tasks: T[]): Promise<void> {
    throw new Error("Method not implemented.");
  }
  handleError(error: unknown): Promise<void> {
    throw new Error("Method not implemented.");
  }
  finalize(): Promise<void> {
    throw new Error("Method not implemented.");
  }




}