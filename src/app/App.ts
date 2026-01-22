import { PlaywrightBrowser } from "../browser/playwright/PlaywrightBrowser";
import { FileStorage } from "../storage/fs/FileStorage";
import { DummySource } from "../source/implementations/DummySource";
import { DefaultScenario } from "../scenario/scenarios/DefaultScenario";
import { Task } from "../contracts/Task";

export class App {
  async run() {
    const browser = new PlaywrightBrowser();
    const storage = new FileStorage();
    const source = new DummySource();

    console.log("browser = ", browser);
    console.log("storage = ", storage);
    console.log("source = ", source);


    const scenario = new DefaultScenario(source, browser, storage);

    const task: Task = { sku: "TEST-123" };

    await scenario.run(task);
  }
}
