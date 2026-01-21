import { Scenario } from "../Scenario";
import { Source } from "../../source/Source";
import { Storage } from "../../storage/Storage";
import { Browser } from "../../browser/Browser";
import { Task } from "../../contracts/Task";

export class DefaultScenario implements Scenario {
  constructor(
    private source: Source,
    private browser: Browser,
    private storage: Storage
  ) {}

  async run(task: Task): Promise<void> {
    await this.browser.open("https://example.com");

    const results = await this.source.collect(task, this.browser);

    await this.storage.save(results);

    await this.browser.close();
  }
}