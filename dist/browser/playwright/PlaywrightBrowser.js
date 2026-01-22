"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
// import { chromium, Browser as PWBrowser, Page } from "playwright";
const playwright_1 = require("playwright");
class PlaywrightBrowser {
    constructor() {
        this.instance = null;
    }
    get isInitialized() {
        return this.instance !== null;
    }
    async init() {
        if (this.isInitialized)
            return this.instance;
        this.instance = await playwright_1.chromium.launch();
        return this.instance;
    }
    async close() {
        if (!this.isInitialized)
            return; // Защита от лишних вызовов
        await this.instance?.close();
        this.instance = null;
    }
    async runInContext(fn) {
        const browser = await this.init();
        const context = await browser.newContext();
        try {
            return await fn(context);
        }
        finally {
            await context.close();
        }
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
