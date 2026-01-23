import { Scenario } from "../Scenario";
import { Source } from "../../source/Source";
import { Storage } from "../../storage/Storage";
import { IBrowser } from "../../browser/IBrowser";
import { Task } from "../../contracts/Task";

export class DefaultScenario<Browser,Context,Options=void,BrowserContextOptions=void> implements Scenario {
  constructor(
    private source: Source,
    private browser: IBrowser<Browser,Context,Options,BrowserContextOptions>,
    private storage: Storage
  ) {}

  async run(task: Task): Promise<void> {
    // await this.browser.open("https://example.com");

    // const results = await this.source.collect(task, this.browser);

    // await this.storage.save(results);

  }
}