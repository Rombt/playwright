"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
const playwright_1 = require("playwright");
const path = require("path");
const os = require("os");
class PlaywrightBrowser {
    constructor(launchOptions, browserContextOptions) {
        this.launchOptions = launchOptions;
        this.browserContextOptions = browserContextOptions;
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
            return; // т.к. браузер должен быть один
        await this.instance?.close();
        this.instance = null;
    }
    async createContext() {
        const browser = await this.init();
        return await browser.newContext(this.browserContextOptions);
    }
    async runInContext(fn) {
        const context = await this.createContext();
        try {
            return await fn(context);
        }
        finally {
            await context.close();
            this.close();
        }
    }
    async download(context, url) {
        const page = await context.newPage();
        try {
            const [download] = await Promise.all([
                page.waitForEvent('download'),
                page.evaluate(url => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = '';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }, url),
            ]);
            const filename = await download.suggestedFilename();
            const tempPath = path.join(os.tmpdir(), filename);
            await download.saveAs(tempPath);
            return {
                path: tempPath,
                filename,
            };
        }
        finally {
            await page.close();
        }
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
