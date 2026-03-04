import { PlaywrightBrowser } from '../browser/playwright/PlaywrightBrowser';
import { FileStorage } from '../storage/fs/FileStorage';
import { ITask } from '../data/entities/ITask';
import { DefaultScenario } from '../scenario/scenarios/DefaultScenario';
import { RozetkaScenario } from '../scenario/scenarios/RozetkaScenario';

import { LaunchOptions, BrowserContextOptions } from 'playwright';
import { accessSync, readFileSync, constants } from 'node:fs';
import { AppConfig } from '../data/config/appConfig';
import { UnprocessedCollector } from '../data/collectors/UnprocessedCollector';

import { Logger } from '../data/logger/Logger';
import { ConsoleTransport } from '../data/logger/transport/ConsoleTransport';
import { FileTransport } from '../data/logger/transport/FileTransport';

//todo прочитать опции и предать в браузер
// todo где то здесь должен создаваться браузер, один на всё приложение!
// todo где закрывать браузер?

export class App<BrowserOptions> {
  public readonly browserOptions: LaunchOptions = {};
  public readonly contextOptions: BrowserContextOptions = {};
  private readonly config: AppConfig;
  private readonly mode: string;
  private readonly logger: Logger;

  constructor(
    private readonly pathBrowserOptions: string,
    private readonly pathContextOptions: string,
  ) {
    this.config = AppConfig.init();
    Logger.init({
      level: this.config.loggerConfig.level,
      transports: this.config.loggerTransports,
    });
    this.logger = Logger.getInstance();

    const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
    this.mode = modeArg?.split('=')[1] ?? 'dev';

    this.logger.info(`Application is running in ${this.mode} mode`, {
      component: 'App',
      method: 'constructor',
      data: {
        config: this.config.get,
      },
    });

    try {
      //todo убрать повторяющийся код
      accessSync(this.pathBrowserOptions, constants.R_OK);
      const contentBrowserOptions = readFileSync(this.pathBrowserOptions, 'utf-8');
      this.browserOptions = JSON.parse(contentBrowserOptions);

      accessSync(pathContextOptions, constants.R_OK);
      const contentContextOptions = readFileSync(this.pathContextOptions, 'utf-8');
      this.contextOptions = JSON.parse(contentContextOptions);

      this.logger.debug(`The app settings have been received`, {
        component: 'App',
        method: 'constructor()',
        action: 'accessSync(...)',
        data: {
          browserOptions: this.browserOptions,
          contextOptions: this.contextOptions,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to receive application settings`, {
        component: 'App',
        method: 'constructor()',
        action: 'accessSync(...)',
        data: {
          browserOptions: this.browserOptions,
          contextOptions: this.contextOptions,
          errorName: error instanceof Error ? error.name : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      if (error.code === 'ENOENT') {
        throw new Error(
          `Проблемы с одним из файлов настроек по пути: ${this.pathBrowserOptions} или ${this.pathContextOptions}`,
        );
      }
      throw new Error(`Ошибка при обработке JSON: ${error.message}`);
    }
  }

  async run() {
    if (!this.config.resultsFolder) {
      this.logger.error(`Configuration error: "resultsFolder" is undefined in config`, {
        component: 'App',
        method: 'run()',
        action: 'if (!this.config.resultsFolder)',
        data: {
          resultsFolder: this.config.resultsFolder,
        },
      });

      throw new Error('resultsFolder is not defined in config');
    }

    const browser = new PlaywrightBrowser(this.browserOptions, this.contextOptions);
    const unprocessedCollector = new UnprocessedCollector();
    const unprocessedCount = unprocessedCollector.countTotal();
    const storage = new FileStorage(this.config.resultsFolder); //todo перевести относительно папки проекта

    if (this.mode === 'full') {
      this.logger.debug(`Starting processing of brands specified in the configurations`, {
        component: 'App',
        method: 'run()',
        action: "this.mode === 'full'",
        data: {
          configBrands: this.config.brands,
          storage: storage,
        },
      });
      const scenario = new DefaultScenario(browser, storage);
      await scenario.run(this.config.brands);
    } else if (this.mode === 'retry' && unprocessedCount !== 0) {
      //todo добавить перебор сценариев для дополнительного поиска

      this.logger.error(`Detected ${unprocessedCount} unprocessed products`, {
        component: 'App',
        method: 'run()',
        action: "this.mode === 'retry'",
        data: {
          storage: storage,
        },
      });

      const rozetkaScenario = new RozetkaScenario(browser, storage);
      await rozetkaScenario.run();
    }
  }

  async getBrowserOptions() {}
}
