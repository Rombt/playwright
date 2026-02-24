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
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.sources = [];
        this.resources = [];
        this.config = appConfig_1.AppConfig.getInstance();
        this.logger = Logger_1.Logger.getInstance();
        this.maxRetries = this.config.asyncRetry.maxRetries;
        this.maxPage = this.config.asyncPages.maxPage;
        this.maxTask = this.config.asyncTasks.maxTask;
        this.sourcesFolder = this.config.sourcesFolder;
    }
    async run() {
        try {
            const arrTasks = await this.load();
            await this.prepare();
            for (let i = 0; i < arrTasks.length; i += this.maxTask) {
                const batch = arrTasks.slice(i, i + this.maxTask);
                await Promise.all(batch.map((task) => this.process(task)));
            }
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error('RozetkaScenario => run()', {
                    component: 'RozetkaScenario',
                    method: 'run',
                    data: {
                        errorName: error instanceof Error ? error.name : undefined,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
            }
            else {
                this.logger.error('RozetkaScenario => run()', {
                    component: 'RozetkaScenario',
                    method: 'run',
                    data: {
                        errorName: error instanceof Error ? error.name : undefined,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
            }
        }
        finally {
            await this.finalize();
        }
    }
    async load() {
        const unprocessedCollector = new UnprocessedCollector_1.UnprocessedCollector();
        const arrTasks = unprocessedCollector.getPhotoCollectionTasks();
        if (!Array.isArray(arrTasks)) {
            throw new Error('Task file must contain an array');
        }
        return arrTasks;
    }
    async prepare() {
        this.sources = await this.loadSources();
    }
    async process(task) {
        const loggerScope = this.logger.withContext(task.brand_name);
        const source = this.sources.find((s) => s.supports(task));
        if (!source) {
            loggerScope.error('Source not found for task', {
                component: 'RozetkaScenario',
                method: 'process',
                task,
            });
            throw new Error('Source not found');
        }
        const allErrors = [];
        const allData = {};
        const limiter = new RateLimiter_1.RateLimiter(5000);
        const productsPageLinks = {};
        await this.browser.runInContextByChromium(async (context) => {
            //========================    Основной код сценария    ========================
            const url_init = 'https://rozetka.com.ua/';
            const targetUrl = 'https://search.rozetka.com.ua/ua/search/api/v7/autocomplete/?country=UA&lang=ua&text=';
            const products = task.products;
            if (!Array.isArray(products) || products.length === 0) {
                loggerScope.error('Products are absent', {
                    component: 'RozetkaScenario',
                    method: 'process',
                    stage: 'init',
                    data: { task },
                });
                throw new Error('Products are absent');
            }
            const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
            let taskQueue = uniqueProducts.map((p) => p.sku);
            const quantityPage = Math.min(taskQueue.length, this.maxPage);
            const pool = new PagePool_1.PagePool(context, quantityPage);
            this.registerResource(pool);
            //========================    /Основной код сценария    ========================
            //========================    Обработка ОДНОГО SKU    ========================
            const processSku = async (sku, page) => {
                try {
                    const headers = this.buildHeaders(url_init);
                    if (!headers) {
                        throw new Error('Invalid headers');
                    }
                    const autocomplete = await withRetry(() => source.workerHttpRequest(context.request, headers, targetUrl, limiter, sku, {
                        brand_name: task.brand_name,
                    }), {
                        maxRetries: this.config.asyncRetry.maxRetries,
                        isRetryable: helpers_1.isRetryable,
                    });
                    if (!autocomplete.ok || !autocomplete.body) {
                        loggerScope.error('autocomplete is invalid', {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'autocomplete = await withRetry(...)',
                            stage: 'start',
                            data: {
                                result: autocomplete,
                            },
                        });
                        throw new Error(`One of the results from source.workerHttpRequest() is invalid  ${autocomplete}`);
                    }
                    for (const g of autocomplete.body?.data.content.records.goods ?? []) {
                        if (!this.isAutocompleteGood(g))
                            continue;
                        if (!g.title.includes(sku))
                            continue;
                        const result = await withRetry(() => source.worker(g.href, page, limiter, undefined, sku, {
                            brand_name: task.brand_name,
                        }), {
                            maxRetries: this.config.asyncRetry.maxRetries,
                            isRetryable: helpers_1.isRetryable,
                        });
                        for (const r of result) {
                            for (const [skuKey, images] of Object.entries(r.data)) {
                                allData[skuKey] ?? (allData[skuKey] = []);
                                allData[skuKey].push(...images);
                            }
                        }
                    }
                    return { status: 'success', sku };
                }
                catch (e) {
                    return (0, helpers_1.isRetryable)(e)
                        ? { status: 'retry', sku, error: e }
                        : { status: 'fatal', sku, error: e };
                }
            };
            //========================    /Обработка ОДНОГО SKU    ========================
            //========================   Batch runner (без getNext, без race)     ========================
            async function runBatch(skus) {
                const queue = [...skus];
                const results = [];
                const workers = Array.from({ length: quantityPage }, async () => {
                    const page = await pool.acquire();
                    try {
                        const response = await page.goto(url_init, { waitUntil: 'domcontentloaded' });
                        if (!response?.ok()) {
                            throw new Error(`Navigation failed: ${response?.status()}`);
                        }
                        while (queue.length) {
                            const sku = queue.shift();
                            if (!sku) {
                                loggerScope.error(`sku is absent`, {
                                    component: 'PageImageSourceRozetka',
                                    method: 'process',
                                    action: 'while (queue.length)',
                                    stage: 'start',
                                    data: {
                                        sku: sku,
                                    },
                                });
                                throw new Error(`In process method sku is absent`);
                            }
                            const rawSku = sku;
                            const starIndex = rawSku.indexOf('*');
                            const skuNormal = (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '') ?? '';
                            const result = await processSku(skuNormal, page);
                            results.push(result);
                        }
                    }
                    finally {
                        pool.release(page);
                    }
                });
                await Promise.all(workers);
                return results;
            }
            //========================  /Batch runner (без getNext, без race)     ========================
            //========================  Retry wrapper (ЕДИНСТВЕННЫЙ)     ========================
            async function withRetry(action, options) {
                let attempt = 1;
                while (true) {
                    try {
                        return await action();
                    }
                    catch (e) {
                        if (attempt >= options.maxRetries || !options.isRetryable(e)) {
                            throw e;
                        }
                        options.onRetry?.(attempt, e);
                        await (0, helpers_1.waitBeforeRetry)(attempt);
                        attempt++;
                    }
                }
            }
            //========================  /Retry wrapper (ЕДИНСТВЕННЫЙ)     =======================
            //========================   ГЛАВНЫЙ RETRY ЦИКЛ     ========================
            let attempt = 1;
            let currentBatch = taskQueue;
            while (currentBatch.length && attempt <= this.maxRetries) {
                await limiter.sleep(1000, 5000);
                const results = await runBatch.call(this, currentBatch);
                const retryResults = results.filter((r) => r.status === 'retry');
                const fatalResults = results.filter((r) => r.status === 'fatal');
                currentBatch = retryResults.map((r) => r.sku);
                fatalResults.forEach((r) => allErrors.push({
                    error: r.error,
                    targetUrl,
                }));
                attempt++;
            }
            //========================   /ГЛАВНЫЙ RETRY ЦИКЛ     ========================
            //!!==================================================================================================!!
        }, 'fake');
        console.log(`All workers finished  for ${task.brand_name}`);
        const allDataNormalize = (0, helpers_1.normalizeAllData)(allData);
        console.log('allDataNormalize = ');
        console.dir(allDataNormalize, { depth: null, colors: true });
        console.log(`allErrors SearchURL  for ${task.brand_name}   = `);
        console.dir(allErrors, { depth: null, colors: true });
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // await limiter.sleep(1000, 5000);
        // const productsPageLinks = {
        //   '1865231': ['https://rozetka.com.ua/ua/columbia_0990037254005_0192660465388/p388246605/'],
        //   '2079181': ['https://rozetka.com.ua/ua/columbia-195981582994/p446003411/'],
        //   '2103761': ['https://rozetka.com.ua/ua/columbia-195981625394/p446018603/'],
        // };
        // console.log('========================   productsPageLinks = ', productsPageLinks);
        // await this.browser.runInContext(async context => {
        // await this.browser.runInContextByChromium(async context => {
        //   /*Хожу по полученным страницам товаров */ //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //   type IProductLinkItem = {
        //     sku: string;
        //     link: string;
        //   };
        //   type IProdPageError = {
        //     item?: IProductLinkItem;
        //     error: IWorkerError;
        //   };
        //   const uniqueProducts = Object.entries(productsPageLinks).map(([sku, links]) => ({
        //     sku,
        //     links,
        //   }));
        //   const queue = [...uniqueProducts];
        //   const limiter = new RateLimiter(5000);
        //   const taskQueueProdPage: IProductLinkItem[] = [];
        //   for (const [sku, links] of Object.entries(productsPageLinks)) {
        //     for (const link of links) {
        //       taskQueueProdPage.push({ sku, link });
        //     }
        //   }
        //   const runBatchProdPage = async (items: IProductLinkItem[]): Promise<IProdPageError[]> => {
        //     const errors: IProdPageError[] = [];
        //     let index = 0;
        //     const quantityPage = Math.min(queue.length, this.maxPage);
        //     const pool = new PagePool(context, quantityPage);
        //     this.registerResource(pool);
        //     const getNext = (): IProductLinkItem | undefined => {
        //       if (index >= items.length) return undefined;
        //       return items[index++];
        //     };
        //     const workers = Array.from({ length: quantityPage }, async () => {
        //       const page = await pool.acquire();
        //       try {
        //         while (true) {
        //           const item = getNext();
        //           if (!item) break;
        //           try {
        //             const result = await source.worker(item.link, page, limiter, undefined, item.sku);
        //             for (const r of result) {
        //               for (const [sku, images] of Object.entries(r.data)) {
        //                 allData[sku] ??= [];
        //                 allData[sku].push(...images);
        //               }
        //               if (Array.isArray(r.errors)) {
        //                 for (const err of r.errors) {
        //                   try {
        //                     await this.handleError(err);
        //                   } catch (finalErr) {
        //                     errors.push({
        //                       item: { sku: item.sku } as any,
        //                       error: finalErr as IWorkerError,
        //                     });
        //                   }
        //                 }
        //               }
        //             }
        //           } catch (err) {
        //             errors.push({
        //               item: { sku: item.sku } as any,
        //               error: err as IWorkerError,
        //             });
        //           }
        //         }
        //       } finally {
        //         pool.release(page);
        //       }
        //     });
        //     await Promise.allSettled(workers);
        //     return errors;
        //   };
        //   let attemptProdPage = 1;
        //   let currentBatchProdPage = taskQueueProdPage;
        //   while (currentBatchProdPage.length && attemptProdPage <= this.maxRetries) {
        //     console.log(`---> CollectImages for ${task.brand_name} attemptProdPage №`, attemptProdPage);
        //     await limiter.sleep(1000, 5000);
        //     const errors = await runBatchProdPage(currentBatchProdPage);
        //     const retryable = errors.filter(
        //       (e): e is { item: IProductLinkItem; error: IWorkerError } =>
        //         !!e.item && attemptProdPage < this.maxRetries && isRetryable(e.error),
        //     );
        //     currentBatchProdPage = retryable.map(e => e.item);
        //     if (currentBatchProdPage.length) {
        //       await waitBeforeRetry(attemptProdPage);
        //     } else {
        //       errors.forEach(e => {
        //         allErrors.push({
        //           error: e.error,
        //           targetUrl: undefined,
        //         });
        //       });
        //     }
        //     attemptProdPage++;
        //   }
        //   console.log('****** allData = ', allData);
        // }, 'fake');
        // await this.storage.saveJson(allErrors, {
        //   filename: `${task.brand_name}_unprocessed-products.json`,
        //   targetDir: task.brand_name,
        // });
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
        const unprocessedProducts = Array.from(new Map(errors.filter((e) => e.product).map((e) => [e.product.id_product, e.product])).values());
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
    async handleError(error, attempt = 1, context) {
        context?.loggerScope?.error(`Worker error on attempt ${attempt}`, {
            component: 'PageImageSourceRozetka',
            method: 'handleError',
            action: 'retry_logic',
            stage: 'error_caught',
            data: {
                attempt,
                sku: context?.sku,
                debugMeta: context?.debugMeta,
                errorName: error instanceof Error ? error.name : undefined,
                errorMessage: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            },
        });
        // Проверяем возможность повторной попытки
        if (attempt < this.config.asyncRetry.maxRetries && (0, helpers_1.isRetryable)(error)) {
            const delay = await (0, helpers_1.waitBeforeRetry)(attempt);
            context?.loggerScope?.debug(`Retrying after delay ${delay}ms`, {
                component: 'PageImageSourceRozetka',
                method: 'handleError',
                action: 'retry_logic',
                stage: 'retry_scheduled',
                data: { attempt, delay },
            });
            return this.handleError(error, attempt + 1, context);
        }
        // Если retries исчерпаны — пробрасываем ошибку
        throw error;
    }
    buildHeaders(refer = '') {
        const languages = ['uk-UA,uk;q=0.9', 'uk-UA,uk;q=0.8,en;q=0.5'];
        const index = Math.floor(Math.random() * languages.length);
        return {
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': languages[index],
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
