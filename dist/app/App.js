"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const PlaywrightBrowser_1 = require("../browser/playwright/PlaywrightBrowser");
const FileStorage_1 = require("../storage/fs/FileStorage");
const DummySource_1 = require("../source/implementations/DummySource");
const DefaultScenario_1 = require("../scenario/scenarios/DefaultScenario");
const node_fs_1 = require("node:fs");
//todo прочитать опции и предать в браузер
// todo где то здесь должен создаваться браузер, один на всё приложение!
// todo где закрывать браузер?
class App {
    constructor(pathBrowserOptions) {
        this.pathBrowserOptions = pathBrowserOptions;
        this.browserOptions = {};
        try {
            (0, node_fs_1.accessSync)(pathBrowserOptions, node_fs_1.constants.R_OK);
            const content = (0, node_fs_1.readFileSync)(pathBrowserOptions, 'utf-8');
            this.browserOptions = JSON.parse(content);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Файл не найден по пути: ${pathBrowserOptions}`);
            }
            throw new Error(`Ошибка при обработке JSON: ${error.message}`);
        }
    }
    async run() {
        const browser = new PlaywrightBrowser_1.PlaywrightBrowser(this.browserOptions);
        const storage = new FileStorage_1.FileStorage();
        const source = new DummySource_1.DummySource();
        const scenario = new DefaultScenario_1.DefaultScenario(source, browser, storage);
        // const task: Task = { sku: "TEST-123" };
        // await scenario.run(task);
        console.log("browser = ", browser);
    }
    async getBrowserOptions() {
    }
}
exports.App = App;
