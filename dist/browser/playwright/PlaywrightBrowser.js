"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
const playwright_1 = require("playwright");
class PlaywrightBrowser {
    async open(url) {
        if (!this.browser)
            this.browser = await playwright_1.chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
        await this.page.goto(url, { waitUntil: "domcontentloaded" });
    }
    async getHtml() {
        if (!this.page)
            throw new Error("Page not initialized");
        return await this.page.content();
    }
    async find(selector) {
        if (!this.page)
            throw new Error("Page not initialized");
        const el = await this.page.$(selector);
        return el !== null;
    }
    async getAttribute(selector, name) {
        if (!this.page)
            throw new Error("Page not initialized");
        const el = await this.page.$(selector);
        if (!el)
            return null;
        return await el.getAttribute(name);
    }
    async download(url, saveAs) {
        if (!this.page)
            throw new Error("Page not initialized");
        const [download] = await Promise.all([
            this.page.waitForEvent("download"),
            this.page.evaluate((u) => window.open(u), url)
        ]);
        await download.saveAs(saveAs);
    }
    async close() {
        if (this.page)
            await this.page.close();
        if (this.browser)
            await this.browser.close();
        this.page = undefined;
        this.browser = undefined;
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
