"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Actions = void 0;
class Actions {
    page;
    constructor(page) {
        this.page = page;
    }
    async click(selector) {
        await this.page.locator(selector).click();
    }
    async waitForSelector(selector, timeout) {
        await this.page.locator(selector).waitFor({
            timeout,
        });
    }
    async scroll(options) {
        const step = options?.step ?? 1000;
        const delay = options?.delay ?? 200;
        let previousHeight = 0;
        while (true) {
            const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight)
                break;
            previousHeight = currentHeight;
            await this.page.mouse.wheel(0, step);
            await this.page.waitForTimeout(delay);
        }
    }
    async waitForImages() {
        await this.page.waitForLoadState('networkidle');
    }
    async getHtml(selector) {
        if (!selector) {
            return await this.page.content();
        }
        const el = this.page.locator(selector).first();
        return await el.evaluate((node) => node.outerHTML);
    }
    async getAttribute(selector, attr) {
        return await this.page.locator(selector).first().getAttribute(attr);
    }
    async getText(selector) {
        return await this.page.locator(selector).first().textContent();
    }
    async exists(selector) {
        return (await this.page.locator(selector).count()) > 0;
    }
}
exports.Actions = Actions;
