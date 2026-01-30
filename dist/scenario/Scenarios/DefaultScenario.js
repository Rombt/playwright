"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
const PageImageSource_1 = require("../../source/sources/PageImageSource");
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const PagePool_1 = require("../../browser/pool/PagePool");
// import { ImageResult } from "../../contracts/ImageResult";
class DefaultScenario {
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 3;
        this.baseDelay = 500;
        this.maxDelay = 5000;
        this.maxPage = 10;
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
            console.log('***** error = ', error);
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
                const allErrors = [];
                const allData = [];
                const brand = this.getBrands(task)[0];
                const targetUrl = brand.metadata.target_website;
                const products = brand.products;
                const uniqueProducts = Array.from(new Map(products.map(p => [p.sku, p])).values());
                const queue = [...uniqueProducts];
                const source = new PageImageSource_1.default();
                const limiter = new RateLimiter_1.RateLimiter(2000);
                const quantityPage = Math.min(queue.length, this.maxPage);
                const pool = new PagePool_1.PagePool(context, quantityPage);
                let index = 0;
                const getNext = () => {
                    if (index >= queue.length)
                        return undefined;
                    return queue[index++];
                };
                // runWorker обрабатывает retry внутри себя
                const runWorker = async () => {
                    const page = await pool.acquire();
                    try {
                        if (!targetUrl) {
                            const err = { error: 'URL is missing in metadata' };
                            // Если это ретрайable ошибка, handleError сам её повторит
                            try {
                                await this.handleError(err);
                            }
                            catch (finalErr) {
                                allErrors.push(finalErr);
                            }
                            return [];
                        }
                        while (true) {
                            try {
                                // вызываем worker
                                const result = await source.worker(targetUrl, page, limiter, getNext);
                                // можно собрать данные, если нужно
                                if (Array.isArray(result)) {
                                    const typedResult = result;
                                    allData.push(...typedResult.map(r => r.data).flat());
                                }
                                // если в результате есть ошибки, обрабатываем их через handleError
                                if (Array.isArray(result)) {
                                    for (const item of result) {
                                        if (item && Array.isArray(item.errors)) {
                                            for (const err of item.errors) {
                                                try {
                                                    // err уже имеет тип IWorkerError, можно передавать напрямую
                                                    await this.handleError(err);
                                                }
                                                catch (finalErr) {
                                                    allErrors.push(finalErr);
                                                }
                                            }
                                        }
                                    }
                                }
                                // Всё прошло успешно
                                return result;
                            }
                            catch (err) {
                                // Любая ошибка worker
                                try {
                                    await this.handleError({ error: err });
                                }
                                catch (finalErr) {
                                    allErrors.push(finalErr);
                                    return [];
                                }
                            }
                        }
                    }
                    finally {
                        pool.release(page);
                    }
                };
                const workers = Array.from({ length: quantityPage }, () => runWorker());
                const results = await Promise.allSettled(workers);
                console.log('All workers finished.');
                console.dir(allData, { depth: null, colors: true });
                console.log('All final errors:');
                console.dir(allErrors, { depth: null, colors: true });
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
