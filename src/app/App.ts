import { PlaywrightBrowser } from "../browser/playwright/PlaywrightBrowser";
import { FileStorage } from "../storage/fs/FileStorage";
import { DummySource } from "../source/implementations/DummySource";
import { DefaultScenario } from "../scenario/scenarios/DefaultScenario";
import { ITask } from "../Task/ITask";
import { LaunchOptions } from 'playwright';

import { accessSync, readFileSync, constants } from 'node:fs';



    //todo прочитать опции и предать в браузер
    // todo где то здесь должен создаваться браузер, один на всё приложение!
    // todo где закрывать браузер?



export class App<BrowserOptions> {

  public readonly browserOptions: LaunchOptions = {};

  constructor(private readonly pathBrowserOptions: string) {

    try {
      accessSync(pathBrowserOptions, constants.R_OK);
      const content = readFileSync(pathBrowserOptions, 'utf-8');

      this.browserOptions = JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Файл не найден по пути: ${pathBrowserOptions}`);
      }
      throw new Error(`Ошибка при обработке JSON: ${error.message}`);
    }


}


  async run() {
    const browser = new PlaywrightBrowser(this.browserOptions);
    const storage = new FileStorage();
    const source = new DummySource();
    const scenario = new DefaultScenario(source, browser, storage);


    // const task: Task = { sku: "TEST-123" };

    // await scenario.run(task);
console.log("browser = ", browser);


  }

  async getBrowserOptions() {

  }
}
