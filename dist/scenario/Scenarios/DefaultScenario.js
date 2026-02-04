"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const PagePool_1 = require("../../browser/pool/PagePool");
class DefaultScenario {
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 3;
        this.baseDelay = 500;
        this.maxDelay = 5000;
        this.maxPage = 10; // максимальное количество страниц в пуле
        this.maxTask = 5; // количество одновременно выполняемых задач
        this.sourcesFolder = './dist/source/sources';
        // private readonly taskPath: string = 'src/data/tasks/2026-02-03_10-52.json';
        this.taskPath = 'src/data/tasks/puma_for_tests.json';
        this.sources = [];
        this.resources = [];
    }
    async run() {
        try {
            const arrTasks = await this.load();
            await this.prepare();
            for (let i = 0; i < arrTasks.length; i += this.maxTask) {
                const batch = arrTasks.slice(i, i + this.maxTask);
                await Promise.all(batch.map(task => this.process(task)));
            }
        }
        catch (error) {
            console.log('error = ', error);
            // await this.handleError(error);   //todo какие ошибки здесь ловить??
        }
        finally {
            await this.finalize();
        }
    }
    async load() {
        //todo получаем массив путей к файлам перебираем формируем массив задач
        const filePath = path.resolve(process.cwd(), this.taskPath);
        const raw = await fs_1.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(raw);
        const arrTasks = Object.values(data.task);
        if (!Array.isArray(arrTasks)) {
            throw new Error('Task file must contain an array');
        }
        return arrTasks;
    }
    async prepare() {
        this.sources = await this.loadSources();
    }
    async process(task) {
        const source = this.sources.find(s => s.supports(task));
        if (!source)
            throw new Error();
        await this.browser.runInContext(async (context) => {
            const allErrors = [];
            const allData = {};
            const targetUrl = task.metadata.target_website;
            const products = task.products;
            const uniqueProducts = Array.from(new Map(products.map(p => [p.sku, p])).values());
            const queue = [...uniqueProducts];
            const limiter = new RateLimiter_1.RateLimiter(2000);
            const quantityPage = Math.min(queue.length, this.maxPage);
            const pool = new PagePool_1.PagePool(context, quantityPage);
            this.registerResource(pool);
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
                        const err = {
                            error: 'task.metadata.target_website is missing',
                        };
                        allErrors.push(err);
                        return [];
                    }
                    while (true) {
                        try {
                            const result = await source.worker(targetUrl, page, limiter, getNext);
                            for (const r of result) {
                                for (const [sku, images] of Object.entries(r.data)) {
                                    allData[sku] ?? (allData[sku] = []);
                                    allData[sku].push(...images);
                                }
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
                            return result;
                        }
                        catch (err) {
                            // Здесь любая ошибка worker которая не была ним обработана и положена в result.errors
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
            console.log('allData = ', allData);
            console.log('allErrors = ', allErrors);
            /* Скачиваю полученные urls  */
            let imageQueue = [];
            for (const [sku, urls] of Object.entries(allData)) {
                urls.forEach((url, i) => {
                    imageQueue.push({ sku, url, index: i + 1 });
                });
            }
            const processImage = async (page, item) => {
                const { sku, url, index } = item;
                const { buffer, ext } = await limiter.schedule(() => this.browser.download(page, url));
                const filename = `${task.brand_name}_${sku}_${index}${ext}`;
                await this.storage.save({
                    filename,
                    buffer,
                    targetDir: path.join(task.brand_name, sku),
                });
            };
            const runBatch = async (items) => {
                const errors = [];
                const queue = [...items];
                const workers = Array.from({ length: quantityPage }, async () => {
                    const page = await pool.acquire();
                    try {
                        while (true) {
                            const item = queue.shift();
                            if (!item)
                                return;
                            try {
                                await processImage(page, item);
                            }
                            catch (error) {
                                errors.push({ item, error: error });
                            }
                        }
                    }
                    finally {
                        pool.release(page);
                    }
                });
                await Promise.allSettled(workers);
                return errors;
            };
            const handleError = (errors, attempt) => {
                return errors.filter(e => attempt < this.maxRetries && this.isRetryable(e.error));
            };
            let attempt = 1;
            let currentBatch = imageQueue;
            //**************
            while (currentBatch.length && attempt <= this.maxRetries) {
                console.log('---> attempt № ', attempt);
                const errors = await runBatch(currentBatch);
                console.log('errors = ', errors);
                // Отбираем retryable
                const retryable = handleError(errors, attempt);
                currentBatch = retryable.map(e => e.item);
                // Сохраняем окончательные ошибки
                const finalErrors = errors.filter(e => !retryable.includes(e));
                finalErrors.forEach(e => {
                    allErrors.push({
                        error: e.error,
                        targetUrl: e.item.url,
                    });
                });
                if (currentBatch.length) {
                    await this.waitBeforeRetry(attempt);
                }
                attempt++;
            }
            //******************
            console.log('allErrors = ', allErrors);
            const unprocessedProducts = this.getUnprocessedProducts(allErrors);
            await this.storage.saveJson(unprocessedProducts, {
                filename: 'unprocessed-products.json',
                targetDir: task.brand_name,
            });
        });
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
    registerResource(res) {
        this.resources.push(res);
    }
    getUnprocessedProducts(errors) {
        const unprocessedProducts = Array.from(new Map(errors.filter(e => e.product).map(e => [e.product.id_product, e.product])).values());
        return unprocessedProducts;
    }
    async finalize() {
        for (const res of this.resources) {
            try {
                await res.close();
            }
            catch (err) {
                console.warn('Error closing resource:', err);
            }
            finally {
                this.browser.close(); //todo не уверен по поводу этого места закрытия браузера
            }
        }
    }
    async handleError(error, attempt = 1) {
        console.error(`Error on attempt ${attempt}:`, error);
        if (attempt < this.maxRetries && this.isRetryable(error)) {
            await this.waitBeforeRetry(attempt);
            return this.handleError(error, attempt + 1);
        }
        throw error;
    }
    // =================  helpers ============================
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
