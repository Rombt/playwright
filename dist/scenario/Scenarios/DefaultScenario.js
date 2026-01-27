"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
const PlaywrightPageAdapter_1 = require("../../browser/playwright/PlaywrightPageAdapter");
class DefaultScenario {
    constructor(source, browser, storage) {
        this.source = source;
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 10;
        this.baseDelay = 500;
        this.maxDelay = 5000;
    }
    async run() {
        this.browser.runInContext(async (context) => {
            const page = await PlaywrightPageAdapter_1.PlaywrightPageAdapter.create(context);
            try {
                await page.goto('https://google.com');
            }
            catch (err) {
                await this.handleError(err);
            }
        });
    }
    load() {
        throw new Error("Method not implemented.");
    }
    prepare() {
        throw new Error("Method not implemented.");
    }
    process(tasks) {
        throw new Error("Method not implemented.");
    }
    async handleError(error, attempt = 1) {
        console.error(`Error on attempt ${attempt}:`, error);
        if (attempt < this.maxRetries && this.isRetryable(error)) {
            await this.waitBeforeRetry(attempt);
            return this.handleError(error, attempt + 1);
        }
        throw error;
    }
    finalize() {
        throw new Error("Method not implemented.");
    }
    isRetryable(error) {
        if (!error)
            return false;
        // Если это ошибка Playwright с кодом timeout
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            // таймауты и network glitches
            if (msg.includes("timeout") || msg.includes("net::"))
                return true;
            // если страница динамическая
            if (msg.includes("element not found") || msg.includes("not visible"))
                return true;
        }
        if (error?.retryable === true)
            return true;
        return false;
    }
    async waitBeforeRetry(attempt) {
        // экспоненциальный рост: baseDelay * 2^(attempt-1)
        const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
}
exports.DefaultScenario = DefaultScenario;
