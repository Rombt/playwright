"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const PlaywrightBrowser_1 = require("../browser/playwright/PlaywrightBrowser");
const FileStorage_1 = require("../storage/fs/FileStorage");
const DefaultScenario_1 = require("../scenario/scenarios/DefaultScenario");
const node_fs_1 = require("node:fs");
const appConfig_1 = require("../data/config/appConfig");
const UnprocessedCollector_1 = require("../data/collectors/UnprocessedCollector");
//todo прочитать опции и предать в браузер
// todo где то здесь должен создаваться браузер, один на всё приложение!
// todo где закрывать браузер?
class App {
    constructor(pathBrowserOptions, pathContextOptions) {
        this.pathBrowserOptions = pathBrowserOptions;
        this.pathContextOptions = pathContextOptions;
        this.browserOptions = {};
        this.contextOptions = {};
        this.config = appConfig_1.AppConfig.getInstance();
        const modeArg = process.argv.find(arg => arg.startsWith('--mode='));
        this.mode = modeArg?.split('=')[1] ?? 'dev';
        try {
            //todo убрать повторяющийся код
            (0, node_fs_1.accessSync)(this.pathBrowserOptions, node_fs_1.constants.R_OK);
            const contentBrowserOptions = (0, node_fs_1.readFileSync)(this.pathBrowserOptions, 'utf-8');
            this.browserOptions = JSON.parse(contentBrowserOptions);
            (0, node_fs_1.accessSync)(pathContextOptions, node_fs_1.constants.R_OK);
            const contentContextOptions = (0, node_fs_1.readFileSync)(this.pathContextOptions, 'utf-8');
            this.contextOptions = JSON.parse(contentContextOptions);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Проблемы с одним из файлов настроек по пути: ${this.pathBrowserOptions} или ${this.pathContextOptions}`);
            }
            throw new Error(`Ошибка при обработке JSON: ${error.message}`);
        }
    }
    async run() {
        if (!this.config.resultsFolder) {
            throw new Error('resultsFolder is not defined in config');
        }
        const browser = new PlaywrightBrowser_1.PlaywrightBrowser(this.browserOptions, this.contextOptions);
        if (this.mode === 'full') {
            const storage = new FileStorage_1.FileStorage(this.config.resultsFolder); //todo перевести относительно папки проекта
            const scenario = new DefaultScenario_1.DefaultScenario(browser, storage);
            await scenario.run();
        }
        else if (this.mode === 'retry') {
            const unprocessedCollector = new UnprocessedCollector_1.UnprocessedCollector();
            const unprocessedProducts = unprocessedCollector.getProducts('Columbia');
            console.log('unprocessedProducts = ', unprocessedProducts);
            //todo добавить перебор сценариев для дополнительного поиска
        }
    }
    async getBrowserOptions() { }
}
exports.App = App;
