"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
const PlaywrightPageAdapter_1 = require("../../browser/playwright/PlaywrightPageAdapter");
const PageImageSource_1 = require("../../source/sources/PageImageSource");
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const PagePool_1 = require("../../browser/pool/PagePool");
// import { ImageResult } from "../../contracts/ImageResult";
class DefaultScenario {
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 10;
        this.baseDelay = 500;
        this.maxDelay = 5000;
        this.sourcesFolder = './dist/source/sources';
        this.taskPath = 'src/data/tasks/2026-01-20_14-44.json';
        this.sources = [];
    }
    finalize() {
        throw new Error('Method not implemented.');
    }
    async run() {
        try {
            const arrTasks = await this.load();
            await this.prepare();
            await this.process(arrTasks);
        }
        catch (error) {
            // await this.handleError(error);   //todo какие ошибки здесь ловить
        }
        finally {
            // await this.finalize();     //todo
        }
    }
    async load() {
        //todo получаем массив путей к файлам перебираем формируем массив задач
        const arrTasks = [];
        const filePath = path.resolve(process.cwd(), this.taskPath);
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
            await this.browser.runInContext(async (context) => {
                const page = await PlaywrightPageAdapter_1.PlaywrightPageAdapter.create(context);
                const allErrors = [];
                const allData = [];
                const brand = this.getBrands(task)[0];
                const targetUrl = brand.metadata.target_website;
                const products = brand.products;
                const uniqueProducts = Array.from(new Map(products.map(p => [p.sku, p])).values());
                const queue = [...uniqueProducts];
                const source = new PageImageSource_1.default();
                const limiter = new RateLimiter_1.RateLimiter(1000);
                const pool = new PagePool_1.PagePool(context, 5);
                let index = 0;
                const getNext = () => {
                    if (index >= queue.length)
                        return undefined;
                    return queue[index++];
                };
                async function runWorker() {
                    const page = await pool.acquire();
                    try {
                        if (!targetUrl) {
                            allErrors.push({ error: 'URL is missing in metadata' });
                            return [];
                        }
                        return await source.worker(targetUrl, page, limiter, getNext);
                    }
                    finally {
                        pool.release(page);
                    }
                }
                const workers = Array.from({ length: 5 }, () => runWorker());
                const results = await Promise.allSettled(workers);
                for (const r of results) {
                    if (r.status === 'fulfilled') {
                        // allErrors.push(...r.value.errors); //todo
                        // allData.push(...r.value.data);
                    }
                    else {
                        // воркер упал фатально, сохраняем как WorkerError
                        allErrors.push({ error: r.reason });
                    }
                }
                for (const err of allErrors) {
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
    // async finalize(): Promise<void> {
    //       if (this.pageAdapter) {
    //       await this.pageAdapter.close();
    //   }
    //   if (this.browserContext) {
    //       await this.browserContext.close();
    //   }
    //   this.isInitialized = false;
    // }
    async handleError(error, attempt = 1) {
        console.error(`Error on attempt ${attempt}:`, error);
        if (attempt < this.maxRetries && this.isRetryable(error)) {
            await this.waitBeforeRetry(attempt);
            return this.handleError(error, attempt + 1);
        }
        throw error;
    }
    // =================  helpers ============================
    getBrands(task) {
        return Object.values(task.task);
    }
    isRetryable(error) {
        if (!error)
            return false;
        // Если это ошибка Playwright с кодом timeout
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            // таймауты и network glitches
            if (msg.includes('timeout') || msg.includes('net::'))
                return true;
            // если страница динамическая
            if (msg.includes('element not found') || msg.includes('not visible'))
                return true;
        }
        if (error?.retryable === true)
            return true;
        return false;
    }
    async waitBeforeRetry(attempt) {
        const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);
        return new Promise(resolve => setTimeout(resolve, delay));
    }
}
exports.DefaultScenario = DefaultScenario;
