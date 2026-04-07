"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const PagePool_1 = require("../../browser/pool/PagePool");
const appConfig_1 = require("../../data/config/appConfig");
const helpers_1 = require("../../common/helpers");
const Logger_1 = require("../../data/logger/Logger");
const HTMLProcessor_1 = require("../../processing/HTMLProcessor");
const UnprocessedCollector_1 = require("../../data/collectors/UnprocessedCollector");
class DefaultScenario {
    constructor(browser, storage, mode) {
        this.browser = browser;
        this.storage = storage;
        this.mode = mode;
        this.sources = [];
        this.resources = [];
        this.config = appConfig_1.AppConfig.getInstance();
        this.logger = Logger_1.Logger.getInstance();
        this.limiter = new RateLimiter_1.RateLimiter(10000);
        this.maxRetries = this.config.asyncRetry.maxRetries;
        this.maxPage = this.config.asyncPages.maxPage;
        this.maxPageDownloadImg = this.config.asyncPages.maxPageDownloadImg;
        this.maxTask = this.config.asyncTasks.maxTask;
        this.sourcesFolder = this.config.sourcesFolder;
        this.taskPath = this.config.taskPath;
    }
    async run(brands) {
        try {
            const tasks = await this.load(brands);
            await this.prepare();
            await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
            await this.retryUnprocessed(brands);
        }
        catch (error) {
            await this.handleError(error);
        }
        finally {
            await this.finalize();
        }
    }
    async load(brands) {
        const filePath = path.resolve(process.cwd(), this.taskPath);
        const raw = await fs_1.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(raw);
        let tasks = Object.values(data.task);
        if (brands?.length) {
            tasks = tasks.filter((t) => brands.includes(t.brand_name));
        }
        return tasks;
    }
    async prepare() {
        this.sources = await this.loadSources();
    }
    async process(task, loggerScope) {
        const allErrors = [];
        const allProductRaw = [];
        const allData = {};
        const source = this.sources.find((s) => s.supports(task));
        if (!source)
            throw new Error('Source not found');
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
                    const result = await this.withRetry(() => source.worker(task.metadata.target_website, page, this.limiter, product, loggerScope));
                    let hasImages = false;
                    let hasHtml = false;
                    for (const r of result) {
                        if (r.data.images) {
                            hasImages = true;
                            for (const [sku, images] of Object.entries(r.data.images)) {
                                if (!allData[sku]) {
                                    const arr = [];
                                    arr.idProduct = images.idProduct;
                                    allData[sku] = arr;
                                }
                                allData[sku].push(...images);
                            }
                        }
                        if (r.data.html) {
                            hasHtml = true;
                            const processor = new HTMLProcessor_1.HtmlProcessorFactory().create(task.brand_name.toLowerCase());
                            const raw = processor.process(r.data.html);
                            let content;
                            if (Array.isArray(raw)) {
                                // здесь обработка атрибутов примерно так:
                                // конвертируем атрибуты в HTML (или строку)
                                const attributesHtml = raw
                                    .map((a) => `<li><b>${a.name}:</b> ${a.value}</li>`)
                                    .join('');
                                content = {
                                    attributesHtml: `<ul>${attributesHtml}</ul>`,
                                };
                            }
                            else {
                                content = raw;
                            }
                            allProductRaw.push({
                                sku: product.sku,
                                id: product.id_product,
                                content,
                            });
                        }
                    }
                    if (!hasImages || !hasHtml) {
                        throw new Error('Incomplete data');
                    }
                }
                catch (err) {
                    const workerError = this.normalizeError(err);
                    const status = (0, helpers_1.getRetryStatus)(workerError);
                    allErrors.push({
                        ...workerError,
                        product,
                        targetUrl: task.metadata.target_website,
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
        await this.storage.appendJsonUnique(allProductRaw.map((item) => ({
            ...item,
            sku: String(item.sku),
        })), {
            filename: `${task.brand_name}_products_raw.json`,
            targetDir: '',
        });
        await this.storage.saveJson(allErrors, {
            filename: `${task.brand_name}_unprocessed-products.json`,
            targetDir: '',
        });
    }
    async downloadImages(urlsBySku, task, context, loggerScope) {
        const errors = [];
        const pool = new PagePool_1.PagePool(context, this.maxPageDownloadImg);
        const queue = [];
        for (const [sku, urls] of Object.entries(urlsBySku)) {
            urls.forEach((url, i) => queue.push({ sku, url, index: i + 1 }));
        }
        const worker = async (item) => {
            let page;
            try {
                page = await pool.acquire();
                const { buffer, ext } = await this.withRetry(() => this.browser.downloadWithFallback(item.url, page, context, loggerScope));
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
    async withRetry(action) {
        return await action();
    }
    async retryUnprocessed(brands) {
        const collector = new UnprocessedCollector_1.UnprocessedCollector();
        const tasks = collector
            .getPhotoCollectionTasks(this.mode)
            .filter((t) => t.status !== 'fatal');
        if (!tasks.length)
            return;
        await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
    }
    async handleError(error) {
        this.logger.error('Scenario error', { error });
    }
    async finalize() {
        for (const res of this.resources) {
            await res.close().catch(() => { });
        }
        this.browser.close();
    }
    async loadSources() {
        const sources = [];
        const walk = async (dir) => {
            const files = await fs_1.promises.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.resolve(dir, file.name);
                if (file.isDirectory())
                    await walk(fullPath);
                else if (file.name.endsWith('.js')) {
                    const mod = require(fullPath);
                    const Cls = mod.default ?? mod;
                    sources.push(new Cls());
                }
            }
        };
        await walk(this.sourcesFolder);
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
}
exports.DefaultScenario = DefaultScenario;
