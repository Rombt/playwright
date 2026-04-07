"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RozetkaScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const PagePool_1 = require("../../browser/pool/PagePool");
const appConfig_1 = require("../../data/config/appConfig");
const UnprocessedCollector_1 = require("../../data/collectors/UnprocessedCollector");
const helpers_1 = require("../../common/helpers");
const Logger_1 = require("../../data/logger/Logger");
class RozetkaScenario {
    constructor(browser, storage, mode) {
        this.browser = browser;
        this.storage = storage;
        this.mode = mode;
        this.sources = [];
        this.resources = [];
        this.config = appConfig_1.AppConfig.getInstance();
        this.logger = Logger_1.Logger.getInstance();
        this.maxPage = this.config.asyncPages.maxPage;
        this.maxTask = this.config.asyncTasks.maxTask;
        this.sourcesFolder = this.config.sourcesFolder;
    }
    async run() {
        try {
            const tasks = await this.load();
            await this.prepare();
            await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
        }
        catch (error) {
            await this.handleError(error);
        }
        finally {
            await this.finalize();
        }
    }
    async load() {
        const collector = new UnprocessedCollector_1.UnprocessedCollector();
        return collector.getPhotoCollectionTasks(this.mode).filter((t) => t.status !== 'fatal');
    }
    async prepare() {
        this.sources = await this.loadSources();
    }
    async process(task, loggerScope) {
        const source = this.sources.find((s) => s.supports(task));
        if (!source)
            throw new Error('Source not found');
        const allErrors = [];
        const allData = {};
        const limiter = new RateLimiter_1.RateLimiter(5000);
        await this.browser.runInContextByChromium(async (context) => {
            const products = task.products;
            if (!products?.length)
                throw new Error('Products are absent');
            const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
            const pool = new PagePool_1.PagePool(context, Math.min(uniqueProducts.length, this.maxPage));
            const processProduct = async (product) => {
                let page;
                try {
                    page = await pool.acquire();
                    const headers = this.buildHeaders('https://rozetka.com.ua/');
                    const sku = String(product.sku);
                    const autocomplete = await source.workerHttpRequest(context.request, headers, 'https://search.rozetka.com.ua/ua/search/api/v7/autocomplete/?country=UA&lang=ua&text=', limiter, sku, { brand_name: task.brand_name }, loggerScope);
                    const body = autocomplete.body;
                    if (!autocomplete.ok || !autocomplete.body) {
                        throw new Error('Autocomplete failed');
                    }
                    let found = false;
                    for (const g of body?.data.content.records.goods ?? []) {
                        if (!this.isAutocompleteGood(g))
                            continue;
                        if (!g.title.includes(sku))
                            continue;
                        found = true;
                        const result = await source.worker(g.href, page, limiter, product, loggerScope);
                        for (const r of result) {
                            for (const [skuKey, images] of Object.entries(r.data.images ?? {})) {
                                if (!allData[skuKey]) {
                                    const arr = [];
                                    arr.idProduct = images.idProduct;
                                    allData[skuKey] = arr;
                                }
                                allData[skuKey].push(...images);
                            }
                        }
                    }
                    if (!found) {
                        throw new Error('Product not found');
                    }
                }
                catch (err) {
                    const workerError = this.normalizeError(err);
                    const status = (0, helpers_1.getRetryStatus)(workerError);
                    allErrors.push({
                        ...workerError,
                        product,
                        status,
                    });
                }
                finally {
                    if (page)
                        pool.release(page);
                }
            };
            await Promise.allSettled(uniqueProducts.map(processProduct));
            const normalized = (0, helpers_1.normalizeAllData)(allData);
            const imageErrors = await this.downloadImages(normalized, task, context, loggerScope);
            allErrors.push(...imageErrors);
        });
        await this.storage.saveJson(allErrors, {
            filename: `${task.brand_name}_unprocessed-products.json`,
            targetDir: '',
        });
    }
    async downloadImages(urlsBySku, task, context, loggerScope) {
        const errors = [];
        const pool = new PagePool_1.PagePool(context, this.maxPage);
        const queue = [];
        for (const [sku, urls] of Object.entries(urlsBySku)) {
            urls.forEach((url, i) => {
                queue.push({ sku, url, index: i + 1 });
            });
        }
        const worker = async (item) => {
            let page;
            try {
                page = await pool.acquire();
                const { buffer, ext } = await this.browser.downloadStaticResource(item.url, context, loggerScope);
                await this.storage.save({
                    filename: `${item.sku}_${item.index}${ext}`,
                    buffer,
                    targetDir: '',
                });
            }
            catch (err) {
                const workerError = this.normalizeError(err);
                const status = (0, helpers_1.getRetryStatus)(workerError);
                errors.push({
                    ...workerError,
                    targetUrl: item.url,
                    status,
                });
            }
            finally {
                if (page)
                    pool.release(page);
            }
        };
        await Promise.allSettled(queue.map(worker));
        await this.storage.saveJson(errors, {
            filename: `${task.brand_name}_undownloaded_images.json`,
            targetDir: '',
        });
        return errors;
    }
    async handleError(error) {
        this.logger.error('RozetkaScenario error', { error });
    }
    async finalize() {
        for (const res of this.resources) {
            await res.close().catch(() => { });
        }
        this.browser.close();
    }
    async loadSources() {
        const files = await fs_1.promises.readdir(this.sourcesFolder);
        const sources = [];
        for (const file of files) {
            if (!file.endsWith('.js'))
                continue;
            const mod = require(path.resolve(this.sourcesFolder, file));
            const Cls = mod.default ?? mod;
            sources.push(new Cls());
        }
        return sources;
    }
    registerResource(res) {
        this.resources.push(res);
    }
    async runWithWorkerPool(tasks, handler) {
        let index = 0;
        const worker = async () => {
            while (index < tasks.length) {
                const current = tasks[index++];
                await handler(current);
            }
        };
        await Promise.all(Array.from({ length: this.maxTask }, worker));
    }
    normalizeError(err) {
        if (err instanceof Error)
            return { error: err };
        return { error: new Error(String(err)) };
    }
    buildHeaders(refer = '') {
        return {
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'uk-UA,uk;q=0.9',
            Referer: refer,
        };
    }
    isAutocompleteGood(obj) {
        return (typeof obj === 'object' &&
            obj !== null &&
            'title' in obj &&
            typeof obj.title === 'string' &&
            'href' in obj &&
            typeof obj.href === 'string');
    }
}
exports.RozetkaScenario = RozetkaScenario;
