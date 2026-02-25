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
            this.logger.debug(`The array of unprocessed products was received`, {
                component: 'RozetkaScenario',
                method: 'run()',
                action: 'arrTasks = await this.load()',
                data: {
                    arrTasks: arrTasks,
                },
            });
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
            //========================    Инициализация сценария    ========================
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
            loggerScope.debug('A unique of unique products is created', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'const uniqueProducts = Array.from(...)',
                data: {
                    uniqueProducts: uniqueProducts,
                },
            });
            let taskQueue = uniqueProducts.map((p) => p.sku);
            loggerScope.debug('A task queue s is created', {
                component: 'RozetkaScenario',
                method: 'process',
                action: 'string[] = uniqueProducts.map(...)',
                data: {
                    taskQueue: taskQueue,
                },
            });
            const quantityPage = Math.min(taskQueue.length, this.maxPage);
            const pool = new PagePool_1.PagePool(context, quantityPage);
            this.registerResource(pool);
            //========================    /Инициализация сценария    ========================
            //========================    Обработка ОДНОГО SKU    ========================
            const processSku = async (sku, page) => {
                try {
                    const headers = this.buildHeaders(url_init);
                    if (!headers || typeof headers !== 'object') {
                        loggerScope.error('Headers are invalid', {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'processSku',
                            data: {
                                headers: headers,
                            },
                        });
                        throw new Error('Headers are invalid');
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
                        if (!this.isAutocompleteGood(g)) {
                            loggerScope.debug('Missing or invalid goods in the workerHttpRequest results', {
                                component: 'RozetkaScenario',
                                method: 'process',
                                action: 'for (const g of autocomplete.body?.data.content.records.goods ?? [])',
                                data: {
                                    sku: g,
                                },
                            });
                            continue;
                        }
                        if (!g.title.includes(sku))
                            continue;
                        loggerScope.debug('Product contains required SKU in the title', {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'if (!g.title.includes(sku)) continue;',
                            data: {
                                sku: sku,
                                currentProduct: g,
                            },
                        });
                        // сбор фото у найденных товаров
                        const result = await withRetry(() => source.worker(g.href, page, limiter, undefined, sku, {
                            brand_name: task.brand_name,
                        }), {
                            maxRetries: this.config.asyncRetry.maxRetries,
                            isRetryable: helpers_1.isRetryable,
                        });
                        loggerScope.debug(`The collection of photos url for   ${task.brand_name}    ${sku}    is complete`, {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'const result = await withRetry(...)',
                            data: {
                                attempt: attempt,
                                result: result,
                            },
                        });
                        //!!!!!!!!!!!!!!!
                        //todo при удачном сборе фото для данного sku нужно удалять этот товар из файла не обработанных товаров
                        //!!!!!!!!!!!!!!!
                        for (const r of result) {
                            for (const [skuKey, images] of Object.entries(r.data)) {
                                loggerScope.debug(`Found url photo for   ${task.brand_name}    ${skuKey}`, {
                                    component: 'RozetkaScenario',
                                    method: 'process',
                                    action: 'for (const r of result) {...}',
                                    data: {
                                        attempt: attempt,
                                    },
                                });
                                allData[skuKey] ?? (allData[skuKey] = []);
                                allData[skuKey].push(...images);
                            }
                        }
                    }
                    loggerScope.debug(`The process  ${task.brand_name}    ${sku}    is complete`, {
                        component: 'RozetkaScenario',
                        method: 'process',
                        action: 'for (const r of result) {...}',
                        data: {
                            attempt: attempt,
                            allData: allData,
                        },
                    });
                    return { status: 'success', sku };
                }
                catch (e) {
                    loggerScope.error(`Error during processing ${sku}  `, {
                        component: 'RozetkaScenario',
                        method: 'process',
                        action: 'const result = await withRetry(...)',
                        data: {
                            attempt: attempt,
                            status: status,
                            error: e,
                        },
                    });
                    return (0, helpers_1.isRetryable)(e)
                        ? { status: 'retry', sku, error: e }
                        : { status: 'fatal', sku, error: e };
                }
            };
            //========================   Batch runner      ========================
            async function runBatch(skus) {
                const queue = [...skus];
                const results = [];
                loggerScope.debug(`Batch runner is started`, {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'runBatch(skus: string[])',
                    data: {
                        attempt: attempt,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                        queue: queue,
                        results: results,
                    },
                });
                const workers = Array.from({ length: quantityPage }, async () => {
                    const page = await pool.acquire();
                    loggerScope.debug(`Workers into Batch runner is started`, {
                        component: 'RozetkaScenario',
                        method: 'process',
                        action: 'const workers = Array.from(...)',
                        data: {
                            url_init: url_init,
                            page: page,
                        },
                    });
                    try {
                        const response = await page.goto(url_init, { waitUntil: 'domcontentloaded' });
                        loggerScope.debug(`Try to go to ${url_init}`, {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'response = await page.goto(...)',
                            data: {
                                url_init: url_init,
                                response: response,
                            },
                        });
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
                    catch (err) {
                        const error = err instanceof Error ? err : new Error(String(err));
                        loggerScope.error(`Error into workers into Batch runner`, {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'catch (err)',
                            data: {
                                attempt: attempt,
                                currentBatchLength: currentBatch.length,
                                currentBatch: currentBatch,
                                queue: queue,
                                results: results,
                                url_init: url_init,
                                message: error.message,
                                stack: error.stack,
                                name: error.name,
                            },
                        });
                    }
                    finally {
                        pool.release(page);
                    }
                });
                await Promise.all(workers);
                return results;
            }
            //========================  Retry wrapper (ЕДИНСТВЕННЫЙ)     ========================
            async function withRetry(action, options) {
                let attempt = 1;
                loggerScope.debug('withRetry() starting .... ', {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'async function withRetry(...){...}',
                    data: {
                        attempt: attempt,
                        action: action,
                        options: options,
                    },
                });
                while (true) {
                    try {
                        return await action();
                    }
                    catch (e) {
                        if (attempt >= options.maxRetries || !options.isRetryable(e)) {
                            loggerScope.error('In withRetry() error don`t fixed  ', {
                                component: 'RozetkaScenario',
                                method: 'process',
                                action: 'async function withRetry(...){...}',
                                data: {
                                    attempt: attempt,
                                    action: action,
                                    options: options,
                                    error: e,
                                },
                            });
                            throw e;
                        }
                        loggerScope.error('In withRetry() try fix error  ', {
                            component: 'RozetkaScenario',
                            method: 'process',
                            action: 'async function withRetry(...){...}',
                            data: {
                                attempt: attempt,
                                action: action,
                                options: options,
                                error: e,
                            },
                        });
                        options.onRetry?.(attempt, e);
                        await (0, helpers_1.waitBeforeRetry)(attempt);
                        attempt++;
                    }
                }
            }
            //========================   ГЛАВНЫЙ RETRY ЦИКЛ     ========================
            let attempt = 1;
            let currentBatch = taskQueue;
            while (currentBatch.length && attempt <= this.maxRetries) {
                await limiter.sleep(1000, 5000);
                loggerScope.debug(`Main retry cycle is started`, {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'while (currentBatch.length && attempt <= this.maxRetries) {...}',
                    data: {
                        attempt: attempt,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                    },
                });
                const results = await runBatch.call(this, currentBatch);
                const retryResults = results.filter((r) => r.status === 'retry');
                loggerScope.debug(`Received retry results `, {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'const results: TaskResult[] = await runBatch.call(this, currentBatch);',
                    data: {
                        attempt: attempt,
                        retryResults: retryResults,
                    },
                });
                const fatalResults = results.filter((r) => r.status === 'fatal');
                loggerScope.debug(`Received fatal results `, {
                    component: 'RozetkaScenario',
                    method: 'process',
                    action: 'const results: TaskResult[] = await runBatch.call(this, currentBatch);',
                    data: {
                        attempt: attempt,
                        fatalResults: fatalResults,
                    },
                });
                currentBatch = retryResults.map((r) => r.sku);
                fatalResults.forEach((r) => allErrors.push({
                    error: r.error,
                    targetUrl,
                }));
                attempt++;
            }
            //========================   /ГЛАВНЫЙ RETRY ЦИКЛ     ========================
        }, 'fake');
        loggerScope.debug(`The process of    ${task.brand_name}    is complete`, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'this.browser.runInContextByChromium(...)',
            data: {
                allData: allData,
            },
        });
        console.log(`All workers finished  for ${task.brand_name}`);
        const allDataNormalize = (0, helpers_1.normalizeAllData)(allData);
        loggerScope.debug(`The results are normalize`, {
            component: 'RozetkaScenario',
            method: 'process',
            action: 'const allDataNormalize = normalizeAllData(allData)',
            data: {
                allDataNormalize: allDataNormalize,
            },
        });
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
