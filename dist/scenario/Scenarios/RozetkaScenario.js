"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RozetkaScenario = void 0;
const fs_1 = require("fs");
const path = require("path");
class RozetkaScenario {
    constructor(browser, storage) {
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 5;
        this.baseDelay = 500;
        this.maxDelay = 10000;
        this.maxPage = 10; // максимальное количество страниц в пуле
        this.maxTask = 5; // количество одновременно выполняемых задач
        this.sourcesFolder = './dist/source/sources';
        this.taskPath = 'src/data/tasks/rozetka_tests.json';
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
        }
        finally {
            await this.finalize();
        }
    }
    async load() {
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
        await this.browser.runInContext(async (context) => { });
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
exports.RozetkaScenario = RozetkaScenario;
