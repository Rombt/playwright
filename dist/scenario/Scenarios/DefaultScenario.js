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
        this.maxRetries = 5;
        this.baseDelay = 500;
        this.maxDelay = 5000;
        this.maxPage = 10; // максимальное количество страниц в пуле
        this.maxTask = 5; // количество одновременно выполняемых задач
        this.sourcesFolder = './dist/source/sources';
        this.taskPath = 'src/data/tasks/columbia_puma_for_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/puma_for_tests.json';
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
            console.log('error in run() = ');
            console.dir(error, { depth: null, colors: true });
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
        const allErrors = [];
        await this.browser.runInContext(async (context) => {
            const allData = {};
            const targetUrl = task.metadata.target_website;
            const products = task.products;
            const uniqueProducts = Array.from(new Map(products.map(p => [p.sku, p])).values());
            const queue = [...uniqueProducts];
            const limiter = new RateLimiter_1.RateLimiter(2000);
            const quantityPage = Math.min(queue.length, this.maxPage);
            const pool = new PagePool_1.PagePool(context, quantityPage);
            this.registerResource(pool);
            let taskQueue = [...queue];
            const runBatch = async (items) => {
                const errors = [];
                let index = 0;
                const getNext = () => {
                    if (index >= items.length)
                        return undefined;
                    return items[index++];
                };
                const workers = Array.from({ length: quantityPage }, async () => {
                    const page = await pool.acquire();
                    try {
                        const result = await source.worker(targetUrl, page, limiter, getNext);
                        for (const r of result) {
                            for (const [sku, images] of Object.entries(r.data)) {
                                allData[sku] ?? (allData[sku] = []);
                                allData[sku].push(...images);
                            }
                            if (Array.isArray(r.errors)) {
                                for (const err of r.errors) {
                                    try {
                                        await this.handleError(err);
                                    }
                                    catch (finalErr) {
                                        errors.push({
                                            item: err.product,
                                            error: finalErr,
                                        });
                                    }
                                }
                            }
                        }
                    }
                    catch (err) {
                        errors.push({
                            item: undefined,
                            error: err,
                        });
                    }
                    finally {
                        pool.release(page);
                    }
                });
                await Promise.allSettled(workers);
                return errors;
            };
            let attempt = 1;
            let currentBatch = taskQueue;
            while (currentBatch.length && attempt <= this.maxRetries) {
                console.log(`---> SearchURL for ${task.brand_name}  attempt №`, attempt);
                const errors = await runBatch(currentBatch);
                console.log(`errors of SearchURL  for ${task.brand_name}  = `);
                console.dir(errors, { depth: null, colors: true });
                const retryable = errors.filter((e) => !!e.item && attempt < this.maxRetries && this.isRetryable(e.error));
                currentBatch = retryable.map(e => e.item);
                if (currentBatch.length) {
                    await this.waitBeforeRetry(attempt);
                }
                else {
                    // оставшиеся ошибки записываем в глобальный пул ошибок
                    errors.forEach(e => {
                        allErrors.push({
                            error: e.error,
                            targetUrl: targetUrl ?? undefined,
                        });
                    });
                }
                attempt++;
            }
            console.log(`All workers finished  for ${task.brand_name}`);
            const allDataNormalize = this.normalizeAllData(allData);
            console.log(`allErrors SearchURL  for ${task.brand_name}   = `);
            console.dir(allErrors, { depth: null, colors: true });
            /* Скачиваю полученные urls  */
            let imageQueue = [];
            for (const [sku, urls] of Object.entries(allDataNormalize)) {
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
            const runBatchImage = async (items) => {
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
            // todo должна быть централизованная обработка ошибок в методе handleError
            const procError = (errors, attempt) => {
                return errors.filter(e => attempt < this.maxRetries && this.isRetryable(e.error));
            };
            let attemptImage = 1;
            let currentBatchImage = imageQueue;
            while (currentBatchImage.length && attemptImage <= this.maxRetries) {
                console.log(`---> DownloadImage  for ${task.brand_name}   attempt №`, attemptImage);
                const errors = await runBatchImage(currentBatchImage);
                console.log(`errors of DownloadImage  for ${task.brand_name}  = `);
                console.dir(errors, { depth: null, colors: true });
                // Отбираем retryable
                const retryable = procError(errors, attemptImage);
                currentBatchImage = retryable.map(e => e.item);
                if (currentBatchImage.length) {
                    await this.waitBeforeRetry(attemptImage);
                }
                else {
                    // Сохраняем окончательные ошибки
                    errors.forEach(e => {
                        allErrors.push({
                            error: e.error,
                            targetUrl: e.item.url,
                        });
                    });
                }
                attemptImage++;
            }
        });
        console.log('END allErrors = ');
        console.dir(allErrors, { depth: null, colors: true });
        await this.storage.saveJson(allErrors, {
            filename: `${task.brand_name}_unprocessed-products.json`,
            targetDir: task.brand_name,
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
        console.log('getUnprocessedProducts    errors = ', errors);
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
    normalizeAllData(source) {
        const map = new Map();
        for (const [key, urls] of Object.entries(source)) {
            if (!map.has(key)) {
                map.set(key, new Set());
            }
            const set = map.get(key);
            for (const url of urls) {
                set.add(url);
            }
        }
        return Object.fromEntries([...map.entries()].map(([key, set]) => [key, [...set]]));
    }
    isRetryable(error) {
        if (!error)
            return false;
        // Если это ошибка Playwright с кодом timeout
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            error.retryable = true;
            // таймауты и network glitches
            if (msg.includes('timeout') || msg.includes('net::'))
                return true;
            // если страница динамическая
            if (msg.includes('element not found') || msg.includes('not visible'))
                return true;
        }
        if (error?.retryable === true) {
            error.retryable = true;
            return true;
        }
        error.retryable = false;
        return false;
    }
    async waitBeforeRetry(attempt) {
        const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);
        return new Promise(resolve => setTimeout(resolve, delay));
    }
}
exports.DefaultScenario = DefaultScenario;
