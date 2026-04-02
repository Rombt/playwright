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
const SharpImageProcessor_1 = require("../../processing/ImageProcessor/SharpImageProcessor");
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
            this.logger.debug(`after await this.runWithWorkerPool(tasks, (task, loggerScope)`, {
                component: 'DefaultScenario',
                method: 'run()',
                action: '',
                data: {
                    brands: brands,
                    totalTasks: tasks.length,
                    tasks: tasks,
                },
            });
            await this.retryUnprocessed(brands);
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
    async retryUnprocessed(brands) {
        this.logger.debug('Enter retryUnprocessed', {
            component: 'DefaultScenario',
            method: 'retryUnprocessed',
            data: { brands },
        });
        const collector = new UnprocessedCollector_1.UnprocessedCollector();
        const maxAttempts = this.config.asyncRetry.maxAttempts;
        let attempt = 0;
        while (attempt < maxAttempts) {
            const currentCount = collector.countTotal();
            // всё обработано
            if (currentCount === 0) {
                this.logger.debug('No unprocessed products left', {
                    component: 'DefaultScenario',
                    method: 'retryUnprocessed',
                    data: { attempt },
                });
                break;
            }
            this.logger.debug('Retry attempt started', {
                component: 'DefaultScenario',
                method: 'retryUnprocessed',
                data: {
                    attempt: attempt + 1,
                    currentCount,
                },
            });
            let tasks = collector.getPhotoCollectionTasks(this.mode);
            if (brands?.length) {
                tasks = tasks.filter((t) => brands.includes(t.brand_name));
            }
            if (!tasks.length) {
                this.logger.warn('No tasks generated, stopping retry', {
                    component: 'DefaultScenario',
                    method: 'retryUnprocessed',
                });
                break;
            }
            await this.runWithWorkerPool(tasks, (task, loggerScope) => this.process(task, loggerScope));
            const newCount = collector.countTotal();
            if (newCount >= currentCount) {
                this.logger.warn('No progress in retry, stopping', {
                    component: 'DefaultScenario',
                    method: 'retryUnprocessed',
                    data: { attempt, currentCount, newCount },
                });
                break;
            }
            attempt++;
            await this.limiter.sleepNormal(this.config.asyncRetry.baseDelay, this.config.asyncRetry.maxDelay);
        }
        this.logger.debug('Retry finished', {
            component: 'DefaultScenario',
            method: 'retryUnprocessed',
            data: {
                attemptsDone: attempt,
            },
        });
    }
    async runWithWorkerPool(tasks, handler) {
        let index = 0;
        const getNextTask = () => {
            if (index >= tasks.length)
                return null;
            const currentIndex = index;
            index++;
            return {
                task: tasks[currentIndex],
                index: currentIndex,
            };
        };
        const worker = async (workerId) => {
            this.logger.debug(`Worker ${workerId} started`);
            while (true) {
                const next = getNextTask();
                if (!next) {
                    this.logger.debug(`Worker ${workerId} finished`);
                    return;
                }
                const { task, index: currentIndex } = next;
                const loggerScope = this.logger.withContext(`Worker ${workerId} Task#${currentIndex} ${task.brand_name}`);
                loggerScope.debug('Task received');
                try {
                    await handler(task, loggerScope);
                    loggerScope.debug('Task completed');
                }
                catch (error) {
                    loggerScope.error('Worker task error', {
                        task,
                        errorName: error instanceof Error ? error.name : undefined,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    });
                }
            }
        };
        const workers = Array.from({ length: this.maxTask }, (_, i) => worker(i));
        await Promise.allSettled(workers);
        this.logger.info('All task groups have been processed', {
            component: 'DefaultScenario',
            method: 'runWithWorkerPool',
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
        const allData = {};
        const allProductRaw = [];
        // await this.browser.runInContext(async (context) => {
        await this.browser.runInContextByChromium(async (context) => {
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
            let page;
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
                    page = await pool.acquire();
                    loggerScope?.debug('Beginning processing of product', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'const processProduct = async (product: IProduct)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            limiter: this.limiter,
                        },
                    });
                    const result = await this.withRetry(() => source.worker(task.metadata.target_website, page, this.limiter, product, loggerScope), {
                        maxRetries: this.maxRetries,
                        isRetryable: helpers_1.isRetryable,
                    }, this.limiter, loggerScope);
                    loggerScope?.debug('Product processing finished', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'await this.withRetry(...)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            limiter: this.limiter,
                            result: result,
                        },
                    });
                    for (const r of result) {
                        for (const [sku, images] of Object.entries(r.data.images ?? {})) {
                            if (!allData[sku]) {
                                const arr = [];
                                arr.idProduct = images.idProduct;
                                allData[sku] = arr;
                            }
                            allData[sku].push(...images);
                        }
                        if (r.data.html) {
                            const processor = new HTMLProcessor_1.HtmlProcessorFactory().create(task.brand_name.toLowerCase());
                            console.log('processor = ', processor);
                            const rawContent = processor.process(r.data.html);
                            if (Array.isArray(rawContent)) {
                                // здесь в будущем обработка атрибутов товара
                            }
                            else {
                                allProductRaw.push({
                                    sku: product.sku,
                                    id: product.id_product,
                                    content: rawContent,
                                });
                                //todo добавить возможность записывать в json файл кусками вместо того что бы держать в памяти
                            }
                        }
                    }
                    loggerScope?.debug('Image data aggregation finished', {
                        component: 'DefaultScenario',
                        method: 'process()',
                        action: 'for (const r of result)',
                        data: {
                            product: product,
                            targetWebsite: task.metadata.target_website,
                            limiter: this.limiter,
                            result: result,
                            status: 'success',
                            allDataCount: allData.length,
                            allData: allData,
                            allProductRaw: allProductRaw,
                        },
                    });
                    // pool.release(page);
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
                finally {
                    if (page) {
                        pool.release(page);
                    }
                }
            };
            let attempt = 1;
            let currentBatch = uniqueProducts;
            while (currentBatch.length > 0 && attempt < this.maxRetries) {
                loggerScope?.debug('Entering retry loop for current batch', {
                    attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                });
                const settled = await Promise.allSettled(currentBatch.map(processProduct));
                // 👉 разделяем результаты
                const fulfilled = settled.filter((r) => r.status === 'fulfilled');
                const rejected = settled.filter((r) => r.status === 'rejected');
                // 👉 логируем ошибки (ВАЖНО!)
                if (rejected.length) {
                    loggerScope?.error('Rejected promises detected', {
                        rejected,
                    });
                    rejected.forEach((r) => {
                        allErrors.push({
                            error: r.reason,
                            targetUrl: task.metadata.target_website ?? undefined,
                        });
                    });
                }
                const results = fulfilled.map((r) => r.value);
                const retryResults = results.filter((r) => r.status === 'retry');
                const fatalResults = results.filter((r) => r.status === 'fatal');
                // 👉 собираем ошибки
                fatalResults.forEach((r) => allErrors.push({
                    error: r.error,
                    targetUrl: task.metadata.target_website ?? undefined,
                }));
                // 👉 следующий батч
                const nextBatch = retryResults.map((r) => r.product);
                loggerScope?.debug('Batch processed', {
                    attempt,
                    currentBatchLength: currentBatch.length,
                    nextBatchLength: nextBatch.length,
                    retryCount: retryResults.length,
                    fatalCount: fatalResults.length,
                    rejectedCount: rejected.length,
                });
                // 💥 КРИТИЧЕСКИЕ ЗАЩИТЫ
                // 1. нет retry → выходим
                if (nextBatch.length === 0) {
                    loggerScope?.debug('No retryable tasks left, breaking loop');
                    break;
                }
                // 2. нет прогресса → выходим
                if (nextBatch.length >= currentBatch.length) {
                    loggerScope?.warn('No progress detected, breaking loop', {
                        current: currentBatch.length,
                        next: nextBatch.length,
                    });
                    break;
                }
                currentBatch = nextBatch;
                attempt++;
            }
            //todo закрыть все страницы pool т.к. для downloadImages() будет использоваться другой pool
            const normalized = (0, helpers_1.normalizeAllData)(allData);
            loggerScope?.debug('All data normalized', {
                component: 'DefaultScenario',
                method: 'process()',
                action: 'normalized = normalizeAllData(allData)',
                data: {
                    normalized: normalized,
                },
            });
            allErrors.push(...(await this.downloadImages(normalized, task, context, this.limiter, loggerScope)));
        });
        // await this.storage.saveJson(allProductRaw, {
        //   filename: `${task.brand_name}_products_raw.json`,
        //   targetDir: '',
        // });
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
    async downloadImages(urlsBySku, task, context, limiter, loggerScope) {
        const queue = [];
        const allErrors = [];
        const ImgPool = new PagePool_1.PagePool(context, this.maxPageDownloadImg);
        loggerScope?.debug('Starting image download for current task', {
            component: 'DefaultScenario',
            method: 'downloadImages()',
            action: 'async downloadImages(...)',
            data: {
                urlsBySku: urlsBySku,
                task: task,
                pool: ImgPool,
                limiter: limiter,
            },
        });
        for (const [sku, urls] of Object.entries(urlsBySku)) {
            urls.forEach((url, i) => queue.push({ sku, url, index: i + 1, idProduct: urls.idProduct }));
        }
        const processImage = async (item) => {
            loggerScope?.debug(`Started processing an image item ${item.index}`, {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'processImage = async (item: IImageItem)',
                data: {
                    item: item,
                },
            });
            let page;
            try {
                page = await ImgPool.acquire();
                const { buffer, ext } = await this.withRetry(() => limiter.schedule(async () => {
                    loggerScope?.debug('Starting scheduled action execution', {
                        component: 'DefaultScenario',
                        method: 'downloadImages()',
                        action: 'limiter.schedule(async () => {',
                        data: {
                            item: item,
                            maxRetries: this.maxRetries,
                        },
                    });
                    return await this.browser.downloadWithFallback(item.url, page, context, loggerScope, { strategy: 'static-first' });
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
                        maxRetries: this.maxRetries,
                        isRetryable: this.maxRetries,
                        ext: ext,
                    },
                });
                let _buf = buffer;
                let _ext = ext;
                if (this.config.convertToJpg) {
                    const imageProcessor = new SharpImageProcessor_1.SharpImageProcessor(this.storage);
                    _buf = await imageProcessor.convertBufferToJpg(buffer);
                    _ext = '.jpg';
                }
                const fileName = `${item.idProduct}_${item.sku}_${item.index}${_ext}`;
                await this.storage.save({
                    filename: fileName,
                    buffer: _buf,
                    targetDir: '',
                });
                loggerScope?.debug(`Image saved: ${fileName}`, {
                    component: 'DefaultScenario',
                    method: 'downloadImages()',
                    action: 'this.storage.save({...})',
                    data: {
                        item: item,
                        maxRetries: this.maxRetries,
                        isRetryable: this.maxRetries,
                        status: 'success',
                    },
                });
                return { status: 'success' };
            }
            catch (err) {
                //todo
                //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                /**
                 * если картинка не закачана её url нужно сохранить в отдельный массив для повторного скачивания!
                 */
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
                        maxRetries: this.maxRetries,
                        isRetryable: (0, helpers_1.isRetryable)(error),
                        status: errorStatus.status,
                        error: error,
                        err: err,
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
                    },
                });
                if (page) {
                    ImgPool.release(page);
                }
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
                    attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch,
                },
            });
            const settledResults = await Promise.allSettled(currentBatch.map((item) => processImage(item)));
            const rejectedResults = settledResults.filter((r) => r.status === 'rejected');
            rejectedResults.forEach((r, index) => {
                allErrors.push({
                    error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
                    targetUrl: currentBatch[index]?.url,
                });
            });
            loggerScope?.debug('Handled rejected promises from current batch', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'rejectedResults.forEach(...)',
                data: {
                    attempt,
                    rejectedCount: rejectedResults.length,
                    rejectedResults,
                },
            });
            // Обрабатываем fulfilled
            const results = settledResults
                .filter((r) => r.status === 'fulfilled')
                .map((r) => r.value);
            loggerScope?.debug('Current batch processing finished', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: 'results = fulfilled values',
                data: {
                    attempt,
                    maxRetries: this.maxRetries,
                    currentBatchLength: currentBatch.length,
                    currentBatch,
                    results,
                },
            });
            // retry
            const retryResults = results.filter((r) => r.status === 'retry');
            loggerScope?.debug('Filtered retryable tasks from current batch results', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: "r.status === 'retry'",
                data: {
                    attempt,
                    retryResults,
                },
            });
            // fatal
            const fatalResults = results.filter((r) => r.status === 'fatal');
            loggerScope?.debug('Filtered fatal tasks from current batch results', {
                component: 'DefaultScenario',
                method: 'downloadImages()',
                action: "r.status === 'fatal'",
                data: {
                    attempt,
                    fatalResults,
                },
            });
            //todo!! urls не сохранённых изображений писать в отдельный файл!
            // fatalResults.forEach((r) =>
            //   allErrors.push({
            //     error: r.error,
            //     targetUrl: r.item.url,
            //   }),
            // );
            // 🔄 формируем новый батч только из retry
            currentBatch = retryResults.map((r) => r.item);
            attempt++;
        }
        return allErrors;
    }
    async withRetry(action, options, limiter, loggerScope) {
        let attempt = 1;
        while (true) {
            try {
                const result = options.timeoutMs
                    ? await Promise.race([
                        action(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${options.timeoutMs}ms`)), options.timeoutMs)),
                    ])
                    : await action();
                return result;
            }
            catch (err) {
                const workerError = this.normalizeError(err);
                loggerScope?.error('Error in withRetry', {
                    attempt,
                    maxRetries: options.maxRetries,
                    message: workerError.error instanceof Error
                        ? workerError.error.message
                        : String(workerError.error),
                    isRetryable: options.isRetryable(workerError),
                });
                if (!options.isRetryable(workerError)) {
                    throw workerError;
                }
                if (attempt >= options.maxRetries) {
                    throw workerError;
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
        const sources = [];
        const walk = async (dir) => {
            const files = await fs_1.promises.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.resolve(dir, file.name);
                if (file.isDirectory()) {
                    await walk(fullPath);
                    continue;
                }
                if (!file.name.endsWith('.js'))
                    continue;
                const sourceModule = require(fullPath);
                const SourceClass = sourceModule.default ?? sourceModule;
                sources.push(new SourceClass());
            }
        };
        await walk(this.sourcesFolder);
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
