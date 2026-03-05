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
class DefaultScenario {
    // private allErrors: IWorkerError[] = [];
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.taskPath = 'src/data/tasks/all_brands_for_test.json';
        // private readonly taskPath: string = 'src/data/tasks/puma_for_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/m-tac_for_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/new_balance_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/nike_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/joma_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/adidas_tests.json';
        // private readonly taskPath: string = 'src/data/tasks/ganzo_tests.json';
        this.sources = [];
        this.resources = [];
        this.config = appConfig_1.AppConfig.getInstance();
        this.logger = Logger_1.Logger.getInstance();
        this.maxRetries = this.config.asyncRetry.maxRetries;
        this.maxPage = this.config.asyncPages.maxPage;
        this.maxTask = this.config.asyncTasks.maxTask;
        this.sourcesFolder = this.config.sourcesFolder;
    }
    async run(brands) {
        try {
            const tasks = await this.load(brands);
            this.logger.debug(`DefaultScenario started`, {
                component: 'DefaultScenario',
                method: 'run()',
                action: 'await this.load(brands)',
                data: {
                    brands: brands,
                    totalTasks: tasks.length,
                    tasks: tasks,
                },
            });
            await this.prepare();
            await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
        }
        catch (error) {
            this.logger.error(`DefaultScenario run() error`, {
                component: 'DefaultScenario',
                method: 'run',
                data: {
                    errorName: error instanceof Error ? error.name : undefined,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
        }
        finally {
            this.logger.debug(`DefaultScenario completed`, {
                component: 'DefaultScenario',
                method: 'run()',
                action: '} finally {',
                data: {
                    brands: brands,
                },
            });
            await this.finalize();
        }
    }
    async runWithWorkerPool(tasks, handler) {
        let index = 0;
        const worker = async () => {
            while (true) {
                const currentIndex = index++;
                this.logger.debug(`Worker № ${currentIndex} is started`, {
                    component: 'DefaultScenario',
                    method: 'runWithWorkerPool',
                    action: 'while (true)',
                    stage: 'start',
                    data: {
                        currentIndex: currentIndex,
                    },
                });
                if (currentIndex >= tasks.length) {
                    this.logger.debug('All tasks are completed', {
                        component: 'DefaultScenario',
                        method: 'runWithWorkerPool',
                        action: 'if (currentIndex >= tasks.length) {...}',
                        data: {
                            currentIndex: currentIndex,
                            tasksLength: tasks.length,
                        },
                    });
                    break;
                }
                const task = tasks[currentIndex];
                const loggerScope = this.logger.withContext(`Worker №${currentIndex} ${task.brand_name}`);
                loggerScope.debug('Received a new task', {
                    component: 'DefaultScenario',
                    method: 'runWithWorkerPool',
                    action: 'const task = tasks[currentIndex];',
                    data: {
                        currentIndex: currentIndex,
                        task: task,
                    },
                });
                try {
                    loggerScope.debug('Gave task it for execution ', {
                        component: 'DefaultScenario',
                        method: 'runWithWorkerPool',
                        action: 'try {...}',
                        data: {
                            currentIndex: currentIndex,
                            task: task,
                        },
                    });
                    await handler(task, loggerScope);
                }
                catch (error) {
                    loggerScope.error(`Worker task error`, {
                        component: 'DefaultScenario',
                        method: 'runWithWorkerPool',
                        data: {
                            task,
                            errorName: error instanceof Error ? error.name : undefined,
                            errorMessage: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                    });
                }
            }
        };
        const workers = Array.from({ length: this.maxTask }, () => worker());
        await Promise.allSettled(workers);
        this.logger.info('All task groups have been processed', {
            component: 'DefaultScenario',
            method: 'runWithWorkerPool',
            action: 'workers = Array.from({ length: this.maxTask }, () => worker()',
            data: {
                totalTasks: tasks.length,
            },
        });
    }
    async load(brands) {
        const filePath = path.resolve(process.cwd(), this.taskPath);
        const raw = await fs_1.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(raw);
        const arrTasks = Object.values(data.task);
        if (arrTasks.length === 0) {
            this.logger.error('Tasks array is invalid or corrupted', {
                component: 'DefaultScenario',
                method: 'load()',
                data: {
                    arrTasks: arrTasks,
                },
            });
            throw new Error('Tasks array is invalid or corrupted');
        }
        if (!brands?.length)
            return arrTasks;
        return arrTasks.filter((task) => brands.includes(task.brand_name));
    }
    async prepare() {
        this.sources = await this.loadSources();
    }
    async process(task, loggerScope) {
        const allErrors = [];
        const source = this.sources.find((s) => s.supports(task));
        if (!source) {
            loggerScope?.error('Source not found for task', {
                component: 'DefaultScenario',
                method: 'process()',
                action: 'if (!source)',
                task,
            });
            throw new Error('Source not found');
        }
        loggerScope?.debug(`The enter to the process method`, {
            component: 'DefaultScenario',
            method: 'process()',
            stage: 'init',
            data: {
                task: task,
                source: source,
            },
        });
        const limiter = new RateLimiter_1.RateLimiter(10000);
        const allData = {};
        await this.browser.runInContext(async (context) => {
            const products = task.products;
            if (!Array.isArray(products) || products.length === 0) {
                loggerScope?.error('Products are absent', {
                    component: 'DefaultScenario',
                    method: 'process()',
                    stage: 'init',
                    data: { task: task },
                });
                throw new Error('Products are absent');
            }
            loggerScope?.debug(`The enter to the browser.runInContext`, {
                component: 'DefaultScenario',
                method: 'process()',
                stage: 'init',
                data: {
                    products: products,
                },
            });
            const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
            loggerScope?.debug('A unique of unique products is created', {
                component: 'DefaultScenario',
                method: 'process()',
                action: 'const uniqueProducts = Array.from(...)',
                data: {
                    uniqueProducts: uniqueProducts,
                },
            });
            const quantityPage = Math.min(uniqueProducts.length, this.maxPage);
            const pool = new PagePool_1.PagePool(context, quantityPage);
            this.registerResource(pool);
            const processProduct = async (product) => {
                if (!task.metadata.target_website) {
                    loggerScope?.error('Task metadata does not contain target_website!!', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'if (!task.metadata.target_website)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                        },
                    });
                    throw new Error('Error!! Task metadata does not contain target_website!!');
                }
                try {
                    const page = await pool.acquire();
                    loggerScope?.debug('Beginning processing of product', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'const processProduct = async (product: IProduct)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            page: page,
                            limiter: limiter,
                        },
                    });
                    const result = await this.withRetry(() => source.worker(task.metadata.target_website, page, limiter, product, loggerScope), {
                        maxRetries: this.maxRetries,
                        isRetryable: helpers_1.isRetryable,
                    }, limiter, loggerScope);
                    loggerScope?.debug('Product processing finished', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'await this.withRetry(...)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            page: page,
                            limiter: limiter,
                            result: result,
                        },
                    });
                    for (const r of result) {
                        for (const [sku, images] of Object.entries(r.data)) {
                            allData[sku] ?? (allData[sku] = []);
                            allData[sku].push(...images);
                        }
                    }
                    loggerScope?.debug('Image data aggregation finished', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'for (const r of result)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            page: page,
                            limiter: limiter,
                            result: result,
                            status: 'success',
                            allDataCount: allData.length,
                            allData: allData,
                        },
                    });
                    pool.release(page);
                    return { status: 'success' };
                }
                catch (err) {
                    const error = err;
                    const errorStatus = (0, helpers_1.isRetryable)(error)
                        ? { status: 'retry', product, error }
                        : { status: 'fatal', product, error };
                    loggerScope?.error('Error during worker execution with retry mechanism.', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'for (const r of result)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            status: errorStatus.status,
                            errorName: error instanceof Error ? error.name : undefined,
                            errorMessage: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined,
                        },
                    });
                    return errorStatus;
                }
            };
            let attempt = 1;
            let currentBatch = uniqueProducts;
            while (currentBatch.length && attempt <= this.maxRetries) {
                // await limiter.sleep(1000, 5000);
                loggerScope?.debug('Entering retry loop for current batch', {
                    component: 'DefaultScenario',
                    method: 'process()',
                    action: 'while (currentBatch.length && attempt <= this.maxRetries) {...',
                    data: {
                        attempt: attempt,
                        maxRetries: this.maxRetries,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                    },
                });
                const results = (await Promise.allSettled(currentBatch.map(processProduct)))
                    .filter((r) => r.status === 'fulfilled')
                    .map((r) => r.value);
                loggerScope?.debug('Current batch processing finished', {
                    component: 'DefaultScenario',
                    method: 'process()',
                    action: 'results = (await Promise.allSettled(currentBatch.map(processProduct)))',
                    data: {
                        attempt: attempt,
                        maxRetries: this.maxRetries,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                        results: results,
                    },
                });
                const retryResults = results.filter((r) => r.status === 'retry');
                loggerScope?.debug('Filtered retryable tasks from current batch results', {
                    component: 'DefaultScenario',
                    method: 'process()',
                    action: "(r): r is Extract<TaskResult, { status: 'retry' }> => r.status === 'retry')",
                    data: {
                        attempt: attempt,
                        maxRetries: this.maxRetries,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                        retryResults: retryResults,
                        results: results,
                    },
                });
                const fatalResults = results.filter((r) => r.status === 'fatal');
                loggerScope?.debug('Filtered fatal tasks from current batch results', {
                    component: 'DefaultScenario',
                    method: 'process()',
                    action: "(r): r is Extract<TaskResult, { status: 'fatal' }> => r.status === 'fatal')",
                    data: {
                        attempt: attempt,
                        maxRetries: this.maxRetries,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                        fatalResults: fatalResults,
                        results: results,
                    },
                });
                fatalResults.forEach((r) => allErrors.push({
                    error: r.error,
                    targetUrl: task.metadata.target_website ?? undefined,
                }));
                currentBatch = retryResults.map((r) => r.product);
                loggerScope?.debug('Next batch prepared from retryable tasks', {
                    component: 'DefaultScenario',
                    method: 'process()',
                    action: 'currentBatch = retryResults.map((r) => r.product)',
                    data: {
                        attempt: attempt,
                        maxRetries: this.maxRetries,
                        currentBatchLength: currentBatch.length,
                        currentBatch: currentBatch,
                    },
                });
                attempt++;
            }
            const normalized = (0, helpers_1.normalizeAllData)(allData);
            loggerScope?.debug('All data normalized', {
                component: 'DefaultScenario',
                method: 'process()',
                action: 'normalized = normalizeAllData(allData)',
                data: {
                    normalized: normalized,
                },
            });
            allErrors.push(...(await this.downloadImages(normalized, task, pool, context, limiter, loggerScope)));
        });
        await this.storage.saveJson(allErrors, {
            filename: `${task.brand_name}_unprocessed-products.json`,
            targetDir: task.brand_name,
        });
    }
    async downloadImages(urlsBySku, task, pool, context, limiter, loggerScope) {
        const queue = [];
        const allErrors = [];
        loggerScope?.debug('Starting image download for current task', {
            component: 'DefaultScenario',
            method: 'downloadImages()',
            action: 'async downloadImages(...)',
            data: {
                urlsBySku: urlsBySku,
                task: task,
                pool: pool,
                limiter: limiter,
            },
        });
        for (const [sku, urls] of Object.entries(urlsBySku)) {
            urls.forEach((url, i) => queue.push({ sku, url, index: i + 1 }));
        }
        const processImage = async (item) => {
            const page = await pool.acquire();
            loggerScope?.debug('Started processing an image item', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'processImage = async (item: IImageItem)',
                data: {
                    item: item,
                    page: page,
                },
            });
            try {
                const { buffer, ext } = await this.withRetry(() => limiter.schedule(async () => {
                    loggerScope?.debug('Starting scheduled action execution', {
                        component: 'DefaultScenario',
                        method: 'downloadImages()',
                        action: 'limiter.schedule(async () => {',
                        data: {
                            item: item,
                            page: page,
                            maxRetries: this.maxRetries,
                        },
                    });
                    return await this.browser.downloadWithFallback(item.url, page, context, loggerScope);
                }), {
                    maxRetries: this.maxRetries,
                    isRetryable: helpers_1.isRetryable,
                }, limiter, loggerScope);
                loggerScope?.debug(`Image download via withRetry completed  ${task.brand_name}/${item.sku}/${item.index}${ext}`, {
                    component: 'DefaultScenario',
                    method: 'downloadImages()',
                    action: 'await this.withRetry(...)',
                    data: {
                        item: item,
                        page: page,
                        maxRetries: this.maxRetries,
                        isRetryable: this.maxRetries,
                        ext: ext,
                    },
                });
                await this.storage.save({
                    filename: `${task.brand_name}_${item.sku}_${item.index}${ext}`,
                    buffer,
                    targetDir: path.join(task.brand_name, item.sku),
                });
                loggerScope?.debug(`Image saved: ${task.brand_name}/${item.sku}/${item.index}${ext}`, {
                    component: 'DefaultScenario',
                    method: 'downloadImages()',
                    action: 'this.storage.save({...})',
                    data: {
                        item: item,
                        page: page,
                        maxRetries: this.maxRetries,
                        isRetryable: this.maxRetries,
                        status: 'success',
                    },
                });
                return { status: 'success' };
            }
            catch (err) {
                const error = err;
                const errorStatus = (0, helpers_1.isRetryable)(error)
                    ? { status: 'retry', item, error }
                    : { status: 'fatal', item, error };
                loggerScope?.error(`Image download or save failed for SKU ${item.sku}`, {
                    component: 'DefaultScenario',
                    method: 'downloadImages()',
                    action: 'this.storage.save({...})',
                    data: {
                        item: item,
                        page: page,
                        maxRetries: this.maxRetries,
                        isRetryable: this.maxRetries,
                        status: errorStatus.status,
                    },
                });
                return errorStatus;
            }
            finally {
                loggerScope?.debug('Releasing page back to pool', {
                    component: 'DefaultScenario',
                    method: 'downloadImages()',
                    action: 'processImage = async (item: IImageItem)',
                    data: {
                        item: item,
                        page: page,
                    },
                });
                pool.release(page);
            }
        };
        let attempt = 1;
        let currentBatch = queue;
        loggerScope?.debug('Before retry loop for current batch initiated', {
            component: 'DefaultScenario',
            method: 'downloadImages()',
            action: '',
            data: {
                attempt: attempt,
                maxRetries: this.maxRetries,
                currentBatchLength: currentBatch.length,
                currentBatch: currentBatch,
            },
        });
        while (currentBatch.length && attempt <= this.maxRetries) {
            await limiter.sleep(1000, 5000);
            loggerScope?.debug('Retry loop initiated for current batch', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'while (currentBatch.length && attempt <= this.maxRetries)',
                data: {
                    attempt: attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch: currentBatch,
                },
            });
            const results = (await Promise.allSettled(currentBatch.map(processImage)))
                .filter((r) => r.status === 'fulfilled')
                .map((r) => r.value);
            loggerScope?.debug('Current batch processing finished', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'results = (await Promise.allSettled(currentBatch.map(processImage)))',
                data: {
                    attempt: attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch: currentBatch,
                    results: results,
                },
            });
            const retryResults = results.filter((r) => r.status === 'retry');
            loggerScope?.debug('Filtered retryable tasks from current batch results', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: "(r): r is Extract<ImageResult, { status: 'retry' }> => r.status === 'retry',))",
                data: {
                    attempt: attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch: currentBatch,
                    retryResults: retryResults,
                    results: results,
                },
            });
            const fatalResults = results.filter((r) => r.status === 'fatal');
            loggerScope?.debug('Filtered fatal tasks from current batch results', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: "(r): r is Extract<ImageResult, { status: 'fatal' }> => r.status === 'fatal',)",
                data: {
                    attempt: attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch: currentBatch,
                    fatalResults: fatalResults,
                    results: results,
                },
            });
            fatalResults.forEach((r) => allErrors.push({
                error: r.error,
                targetUrl: r.item.url,
            }));
            currentBatch = retryResults.map((r) => r.item);
            loggerScope?.debug('Next batch prepared from retryable tasks', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'currentBatch = retryResults.map((r) => r.item)',
                data: {
                    attempt: attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch: currentBatch,
                },
            });
            attempt++;
        }
        return allErrors;
    }
    async withRetry(action, options, limiter, loggerScope) {
        let attempt = 1;
        loggerScope?.debug('Entering withRetry method', {
            component: 'DefaultScenario',
            method: 'async withRetry(...)',
            data: {
                options: options,
                action: action,
            },
        });
        while (true) {
            try {
                loggerScope?.debug('Entering while (true)', {
                    component: 'DefaultScenario',
                    method: 'withRetry(...)',
                    action: 'while (true)',
                    data: {
                        options: options,
                        action: action,
                    },
                });
                return await action();
            }
            catch (err) {
                const { error, meta } = this.normalizeError(err);
                loggerScope?.error('Error in while loop', {
                    method: 'withRetry(...)',
                    action: 'while (true)',
                    data: {
                        options: options,
                        action: action,
                        errorName: error instanceof Error ? error.name : undefined,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
                // if (attempt >= options.maxRetries || !options.isRetryable(err as IWorkerError)) {
                if (attempt >= options.maxRetries) {
                    throw err;
                }
                await (0, helpers_1.waitBeforeRetry)(attempt);
                attempt++;
            }
        }
    }
    async handleError(error, attempt = 1) {
        if (attempt < this.maxRetries && (0, helpers_1.isRetryable)(error)) {
            await (0, helpers_1.waitBeforeRetry)(attempt);
            return this.handleError(error, attempt + 1);
        }
        throw error;
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
    async finalize() {
        for (const res of this.resources) {
            try {
                await res.close();
            }
            catch (err) {
                console.warn(err);
            }
        }
        this.browser.close();
    }
    //todo перенести в helpers
    normalizeError(err) {
        if (err instanceof Error) {
            return { error: err };
        }
        if (typeof err === 'object' && err !== null) {
            const obj = err;
            const message = typeof obj.message === 'string'
                ? obj.message
                : typeof obj.error?.message === 'string'
                    ? obj.error.message
                    : typeof obj.error?.name === 'string'
                        ? obj.error.name
                        : 'Unknown error';
            return {
                error: new Error(message),
                meta: obj,
            };
        }
        return { error: new Error(String(err)) };
    }
}
exports.DefaultScenario = DefaultScenario;
