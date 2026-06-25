"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const PlaywrightBrowser_1 = require("../browser/playwright/PlaywrightBrowser");
const FileStorage_1 = require("../storage/fs/FileStorage");
const node_fs_1 = require("node:fs");
const appConfig_1 = require("../data/config/appConfig");
const UnprocessedCollector_1 = require("../data/collectors/UnprocessedCollector");
const Logger_1 = require("../data/logger/Logger");
const ScenarioFactory_1 = require("../scenario/ScenarioFactory");
//todo прочитать опции и предать в браузер
// todo где то здесь должен создаваться браузер, один на всё приложение!
// todo где закрывать браузер?
class App {
    pathBrowserOptions;
    pathContextOptions;
    browserOptions = {};
    contextOptions = {};
    config;
    mode;
    logger;
    constructor(pathBrowserOptions, pathContextOptions) {
        this.pathBrowserOptions = pathBrowserOptions;
        this.pathContextOptions = pathContextOptions;
        this.config = appConfig_1.AppConfig.init();
        Logger_1.Logger.init({
            level: this.config.loggerConfig.level,
            transports: this.config.loggerTransports,
        });
        this.logger = Logger_1.Logger.getInstance();
        const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
        this.mode = modeArg?.split('=')[1] ?? 'full';
        this.logger.info(`Application is running in ${this.mode} mode`, {
            component: 'App',
            method: 'constructor',
            data: {
                config: this.config.get,
            },
        });
        try {
            //todo убрать повторяющийся код
            (0, node_fs_1.accessSync)(this.pathBrowserOptions, node_fs_1.constants.R_OK);
            const contentBrowserOptions = (0, node_fs_1.readFileSync)(this.pathBrowserOptions, 'utf-8');
            this.browserOptions = JSON.parse(contentBrowserOptions);
            (0, node_fs_1.accessSync)(pathContextOptions, node_fs_1.constants.R_OK);
            const contentContextOptions = (0, node_fs_1.readFileSync)(this.pathContextOptions, 'utf-8');
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
        }
        catch (error) {
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
                throw new Error(`Проблемы с одним из файлов настроек по пути: ${this.pathBrowserOptions} или ${this.pathContextOptions}`);
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
        const browser = new PlaywrightBrowser_1.PlaywrightBrowser(this.browserOptions, this.contextOptions);
        const unprocessedCollector = new UnprocessedCollector_1.UnprocessedCollector();
        const unprocessedCount = unprocessedCollector.countTotal();
        const storage = new FileStorage_1.FileStorage(this.config.resultsFolder); //todo перевести относительно папки проекта
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
            const scenario = ScenarioFactory_1.ScenarioFactory.create(this.config.scenario, browser, storage, this.mode);
            await scenario.run(this.config.brands);
        }
        else if (this.mode === 'retry' && unprocessedCount !== 0) {
            //todo добавить перебор сценариев для дополнительного поиска
            this.logger.error(`Detected ${unprocessedCount} unprocessed products`, {
                component: 'App',
                method: 'run()',
                action: "this.mode === 'retry'",
                data: {
                    storage: storage,
                },
            });
            // todo RozetkaScenario не адаптирована для второй версии приложения
            // const rozetkaScenario = new RozetkaScenario(browser, storage, this.mode);
            // await rozetkaScenario.run();
        }
    }
    async getBrowserOptions() { }
}
exports.App = App;
