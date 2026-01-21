"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const PlaywrightBrowser_1 = require("../browser/playwright/PlaywrightBrowser");
const FileStorage_1 = require("../storage/fs/FileStorage");
const DummySource_1 = require("../source/implementations/DummySource");
const DefaultScenario_1 = require("../scenario/scenarios/DefaultScenario");
class App {
    async run() {
        const browser = new PlaywrightBrowser_1.PlaywrightBrowser();
        const storage = new FileStorage_1.FileStorage();
        const source = new DummySource_1.DummySource();
        const scenario = new DefaultScenario_1.DefaultScenario(source, browser, storage);
        const task = { sku: "TEST-123" };
        await scenario.run(task);
    }
}
exports.App = App;
