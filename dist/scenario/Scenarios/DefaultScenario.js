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
        this.allErrors = [];
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
        const source = this.sources.find((s) => s.supports(task));
        if (!source) {
            loggerScope?.error('Source not found for task', {
                component: 'DefaultScenario',
                method: 'process',
                action: 'if (!source)',
                task,
            });
            throw new Error('Source not found');
        }
        loggerScope?.debug(`The enter to the process method`, {
            component: 'DefaultScenario',
            method: 'process',
            stage: 'init',
            data: {
                task: task,
                source: source,
            },
        });
        const limiter = new RateLimiter_1.RateLimiter(5000);
        const allData = {};
        await this.browser.runInContext(async (context) => {
            const products = task.products;
            if (!Array.isArray(products) || products.length === 0) {
                loggerScope?.error('Products are absent', {
                    component: 'DefaultScenario',
                    method: 'process',
                    stage: 'init',
                    data: { task: task },
                });
                throw new Error('Products are absent');
            }
            loggerScope?.debug(`The enter to the browser.runInContext`, {
                component: 'DefaultScenario',
                method: 'process',
                stage: 'init',
                data: {
                    products: products,
                },
            });
            const uniqueProducts = Array.from(new Map(products.map((p) => [p.sku, p])).values());
            loggerScope?.debug('A unique of unique products is created', {
                component: 'DefaultScenario',
                method: 'process',
                action: 'const uniqueProducts = Array.from(...)',
                data: {
                    uniqueProducts: uniqueProducts,
                },
            });
            const quantityPage = Math.min(uniqueProducts.length, this.maxPage);
            const pool = new PagePool_1.PagePool(context, quantityPage);
            this.registerResource(pool);
            const processProduct = async (entity) => {
                try {
                    const page = await pool.acquire();
                    const result = await this.withRetry(() => source.worker(task.metadata.target_website, page, limiter, () => entity), {
                        maxRetries: this.maxRetries,
                        isRetryable: helpers_1.isRetryable,
                    }, loggerScope);
                    for (const r of result) {
                        for (const [sku, images] of Object.entries(r.data)) {
                            allData[sku] ?? (allData[sku] = []);
                            allData[sku].push(...images);
                        }
                    }
                    pool.release(page);
                    return { status: 'success' };
                }
                catch (err) {
                    const error = err;
                    return (0, helpers_1.isRetryable)(error)
                        ? { status: 'retry', entity, error }
                        : { status: 'fatal', entity, error };
                }
            };
            let attempt = 1;
            let currentBatch = uniqueProducts;
            while (currentBatch.length && attempt <= this.maxRetries) {
                await limiter.sleep(1000, 5000);
                const results = await Promise.all(currentBatch.map(processProduct));
                const retryResults = results.filter((r) => r.status === 'retry');
                const fatalResults = results.filter((r) => r.status === 'fatal');
                fatalResults.forEach((r) => this.allErrors.push({
                    error: r.error,
                    targetUrl: task.metadata.target_website ?? undefined,
                }));
                currentBatch = retryResults.map((r) => r.entity);
                attempt++;
            }
            const normalized = (0, helpers_1.normalizeAllData)(allData);
            await this.downloadImages(normalized, task, pool, limiter, loggerScope);
        });
        await this.storage.saveJson(this.allErrors, {
            filename: `${task.brand_name}_unprocessed-products.json`,
            targetDir: task.brand_name,
        });
    }
    async downloadImages(urlsBySku, task, pool, limiter, loggerScope) {
        const queue = [];
        for (const [sku, urls] of Object.entries(urlsBySku)) {
            urls.forEach((url, i) => queue.push({ sku, url, index: i + 1 }));
        }
        const processImage = async (entity) => {
            const page = await pool.acquire();
            try {
                const { buffer, ext } = await this.withRetry(() => limiter.schedule(() => this.browser.download(page, entity.url)), {
                    maxRetries: this.maxRetries,
                    isRetryable: helpers_1.isRetryable,
                }, loggerScope);
                await this.storage.save({
                    filename: `${task.brand_name}_${entity.sku}_${entity.index}${ext}`,
                    buffer,
                    targetDir: path.join(task.brand_name, entity.sku),
                });
                return { status: 'success' };
            }
            catch (err) {
                const error = err;
                return (0, helpers_1.isRetryable)(error)
                    ? { status: 'retry', entity, error }
                    : { status: 'fatal', entity, error };
            }
        };
        let attempt = 1;
        let currentBatch = queue;
        while (currentBatch.length && attempt <= this.maxRetries) {
            await limiter.sleep(1000, 5000);
            const results = await Promise.all(currentBatch.map(processImage));
            const retryResults = results.filter((r) => r.status === 'retry');
            const fatalResults = results.filter((r) => r.status === 'fatal');
            fatalResults.forEach((r) => this.allErrors.push({
                error: r.error,
                targetUrl: r.entity.url,
            }));
            currentBatch = retryResults.map((r) => r.entity);
            attempt++;
        }
    }
    async withRetry(action, options, loggerScope) {
        let attempt = 1;
        while (true) {
            try {
                return await action();
            }
            catch (err) {
                if (attempt >= options.maxRetries || !options.isRetryable(err)) {
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
}
exports.DefaultScenario = DefaultScenario;
