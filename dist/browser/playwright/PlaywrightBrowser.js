"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
const playwright_1 = require("playwright");
class PlaywrightBrowser {
    constructor(launchOptions) {
        this.launchOptions = launchOptions;
        this.instance = null;
    }
    get isInitialized() {
        return this.instance !== null;
    }
    async init() {
        if (this.isInitialized)
            return this.instance;
        this.instance = await playwright_1.chromium.launch(this.launchOptions);
        return this.instance;
    }
    async close() {
        if (!this.isInitialized)
            return; // Защита от лишних вызовов
        await this.instance?.close();
        this.instance = null;
    }
    async runInContext(fn, options) {
        const browser = await this.init();
        const context = await browser.newContext(options);
        try {
            return await fn(context);
        }
        finally {
            await context.close();
        }
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
