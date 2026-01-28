import { PlaywrightBrowser } from "../browser/playwright/PlaywrightBrowser";
import { FileStorage } from "../storage/fs/FileStorage";
import { ITask } from "../data/entities/ITask";
import { DefaultScenario } from "../scenario/scenarios/DefaultScenario";

import { LaunchOptions, BrowserContextOptions } from 'playwright';
import { accessSync, readFileSync, constants } from 'node:fs';



    //todo прочитать опции и предать в браузер
    // todo где то здесь должен создаваться браузер, один на всё приложение!
    // todo где закрывать браузер?



export class App<BrowserOptions> {

  public readonly browserOptions: LaunchOptions = {};
  public readonly contextOptions: BrowserContextOptions = {};

  constructor(
    private readonly pathBrowserOptions: string,
    private readonly pathContextOptions: string,
  ) {

    try {
      //todo убрать повторяющийся код
      accessSync(this.pathBrowserOptions, constants.R_OK);
      const contentBrowserOptions = readFileSync(this.pathBrowserOptions, 'utf-8');
      this.browserOptions = JSON.parse(contentBrowserOptions);

      accessSync(pathContextOptions, constants.R_OK);
      const contentContextOptions = readFileSync(this.pathContextOptions, 'utf-8');
      this.contextOptions = JSON.parse(contentContextOptions);

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Проблемы с одним из файлов настроек по пути: ${this.pathBrowserOptions} или ${this.pathContextOptions}`);
      }
      throw new Error(`Ошибка при обработке JSON: ${error.message}`);
    }


}


  async run() {
    const browser = new PlaywrightBrowser(this.browserOptions, this.contextOptions);
    const storage = new FileStorage();
    const scenario = new DefaultScenario( browser, storage);




    await scenario.run();


  }

  async getBrowserOptions() {

  }
}
