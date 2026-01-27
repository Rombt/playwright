import { IScenario } from "../IScenario";
import { Source } from "../../source/Source";
import { Storage } from "../../storage/Storage";
import { IBrowser } from "../../browser/IBrowser";
import { ITask } from "../../Task/ITask";

import { PlaywrightBrowser } from "../../browser/playwright/PlaywrightBrowser";

export class DefaultScenario<T extends ITask, Browser,Context> implements IScenario<T, Browser, Context> {



  constructor(
    private source: Source<T>,
    private browser: IBrowser<Browser,Context>,
    private storage: Storage
  ) { }


  async run(): Promise<void> {

    console.log("this.browser.runInContext = ", this.browser.runInContext);

    this.browser.runInContext(async ( context ) => {



     })



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