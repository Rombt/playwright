"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
const PlaywrightPageAdapter_1 = require("../../browser/playwright/PlaywrightPageAdapter");
class DefaultScenario {
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 10;
        this.baseDelay = 500;
        this.maxDelay = 5000;
        this.sourcesFolder = './dist/source/sources';
        this.sources = [];
    }
    finalize() {
        throw new Error("Method not implemented.");
    }
    async run() {
        try {
            const arrTasks = await this.load();
            await this.prepare();
            await this.process(arrTasks);
        }
        catch (error) {
            await this.handleError(error);
        }
        finally {
            // await this.finalize();
        }
    }
    async load() {
        //todo получаем массив путей к файлам перебираем формируем массив задач
        const arrTasks = [];
        const filePath = path.resolve(process.cwd(), 'src/Task/tasks/2026-01-20_14-44.json');
        const raw = await fs_1.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(raw);
        arrTasks.push(data);
        if (!Array.isArray(arrTasks)) {
            throw new Error('Task file must contain an array');
        }
        return arrTasks;
    }
    async prepare() {
        this.sources = await this.loadSources();
    }
    async process(arrTasks) {
        for (const task of arrTasks) {
            const source = this.sources.find(s => s.supports(task));
            if (!source)
                throw new Error();
            const result = await this.browser.runInContext(async (context) => {
                // return source.execute(task, context);
                const page = await PlaywrightPageAdapter_1.PlaywrightPageAdapter.create(context);
                try {
                    await page.goto('https://google.com');
                }
                catch (err) {
                    await this.handleError(err);
                }
            });
            // await this.storage.save(result);
        }
    }
    async loadSources() {
        const files = await fs_1.promises.readdir(this.sourcesFolder);
        const sources = [];
        for (const file of files) {
            if (!file.endsWith('.js'))
                continue;
            const fullPath = path.resolve(this.sourcesFolder, file);
            const sourceModule = require(fullPath);
            const SourceClass = sourceModule.default ?? sourceModule;
            sources.push(new SourceClass());
        }
        return sources;
    }
    async handleError(error, attempt = 1) {
        console.error(`Error on attempt ${attempt}:`, error);
        if (attempt < this.maxRetries && this.isRetryable(error)) {
            await this.waitBeforeRetry(attempt);
            return this.handleError(error, attempt + 1);
        }
        throw error;
    }
    // async finalize(): Promise<void> {
    //       if (this.pageAdapter) {
    //       await this.pageAdapter.close();
    //   }
    //   if (this.browserContext) {
    //       await this.browserContext.close();
    //   }
    //   this.isInitialized = false;
    // }
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
