"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
class DefaultScenario {
    constructor(source, browser, storage) {
        this.source = source;
        this.browser = browser;
        this.storage = storage;
    }
    async run(task) {
        // await this.browser.open("https://example.com");
        const results = await this.source.collect(task, this.browser);
        await this.storage.save(results);
        await this.browser.close();
    }
}
exports.DefaultScenario = DefaultScenario;
