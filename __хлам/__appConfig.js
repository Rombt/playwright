"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfig = void 0;
const path = require("path");
const config_1 = require("../src/config");
const ConsoleTransport_1 = require("../src/data/logger/transport/ConsoleTransport");
const FileTransport_1 = require("../src/data/logger/transport/FileTransport");
class AppConfig {
    static instance;
    baseDir;
    config;
    constructor() {
        this.baseDir = process.cwd();
        this.config = this.buildConfig();
    }
    /**
     * TODO:
     * Добавить возможность передавать путь к файлу конфигурации.
     * По умолчанию использовать:
     * import { config as appConfig } from '../../config';
     */
    static init() {
        if (!this.instance) {
            this.instance = new AppConfig();
        }
        return this.instance;
    }
    static getInstance() {
        if (!this.instance) {
            throw new Error('AppConfig is not initialized. Call init() first.');
        }
        return this.instance;
    }
    /**
     * Построение итоговой конфигурации.
     */
    buildConfig() {
        return {
            data: this.processData(config_1.config),
            async: this.processAsync(config_1.config),
            browser: this.processBrowser(config_1.config),
            logger: this.processLogger(config_1.config),
        };
    }
    // ==========================================================
    // Getters
    // ==========================================================
    /**
     * Получить готовую конфигурацию.
     */
    get get() {
        return this.config;
    }
    get scenario() {
        return this.config.data.scenario ?? 'default';
    }
    get resultsFolder() {
        return this.config.data.resultsFolder;
    }
    get sourcesFolder() {
        return this.config.data.sourcesFolder;
    }
    get stepsFolder() {
        return this.config.data.stepsFolder;
    }
    get strategiesFolder() {
        return this.config.data.strategiesFolder;
    }
    get taskPath() {
        return this.config.data.taskPath;
    }
    get brands() {
        return this.config.data.brands;
    }
    get imageProcessing() {
        return this.config.data.imageProcessing;
    }
    get convertToJpg() {
        return this.config.data.imageProcessing.convertToJpg;
    }
    get minImageWidth() {
        return this.config.data.imageProcessing.minWidth;
    }
    get minImageHeight() {
        return this.config.data.imageProcessing.minHeight;
    }
    get asyncRetry() {
        return this.config.async.retry;
    }
    get asyncTasks() {
        return this.config.async.tasks;
    }
    get asyncPages() {
        return this.config.async.pages;
    }
    get fingerprintFile() {
        return this.config.browser.fingerprintFile;
    }
    get browserMode() {
        return this.config.browser.mode;
    }
    get downloadImages() {
        return this.config.browser.downloadImages;
    }
    get loggerConfig() {
        return this.config.logger;
    }
    get loggerTransports() {
        const transports = [];
        for (const transport of this.loggerConfig.transports ?? []) {
            const factory = this.transportFactories[transport.type];
            if (factory) {
                transports.push(factory(transport));
            }
        }
        return transports;
    }
    // ==========================================================
    // Processors
    // ==========================================================
    processData(rawConfig) {
        const dataConfig = rawConfig.data ?? {};
        const imageProcessing = dataConfig.imageProcessing ?? {};
        const resolveBrands = (value) => Array.isArray(value)
            ? value
                .filter((v) => typeof v === 'string')
                .map((v) => v.trim())
                .filter(Boolean)
            : [];
        return {
            resultsFolder: this.resolvePath(dataConfig.resultsFolder ?? 'results'),
            sourcesFolder: this.resolvePath(dataConfig.sourcesFolder ?? 'source/sources'),
            stepsFolder: this.resolvePath(dataConfig.stepsFolder ?? 'source/steps'),
            strategiesFolder: this.resolvePath(dataConfig.strategiesFolder ?? 'source/strategies'),
            taskPath: this.resolvePath(dataConfig.taskPath ?? 'tasks'),
            brands: resolveBrands(dataConfig.brands),
            scenario: typeof dataConfig.scenario === 'string' ? dataConfig.scenario : 'default',
            imageProcessing: {
                convertToJpg: imageProcessing.convertToJpg ?? false,
                minWidth: typeof imageProcessing.minWidth === 'number' ? imageProcessing.minWidth : 400,
                minHeight: typeof imageProcessing.minHeight === 'number' ? imageProcessing.minHeight : 400,
            },
        };
    }
    processAsync(rawConfig) {
        const asyncConfig = rawConfig.async ?? {};
        const retry = asyncConfig.retry ?? {};
        return {
            retry: {
                baseDelay: typeof retry.baseDelay === 'number' ? retry.baseDelay : 100,
                maxDelay: typeof retry.maxDelay === 'number' ? retry.maxDelay : 3000,
                maxWaitForFreePage: typeof retry.maxWaitForFreePage === 'number' ? retry.maxWaitForFreePage : 60000,
                maxRetries: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
                maxAttempts: typeof retry.maxAttempts === 'number'
                    ? retry.maxAttempts
                    : typeof retry.maxRetries === 'number'
                        ? retry.maxRetries
                        : 3,
            },
            tasks: {
                maxTask: typeof asyncConfig.tasks?.maxTask === 'number' ? asyncConfig.tasks.maxTask : 5,
            },
            pages: {
                maxPage: typeof asyncConfig.pages?.maxPage === 'number' ? asyncConfig.pages.maxPage : 10,
                maxPageDownloadImg: typeof asyncConfig.pages?.maxPageDownloadImg === 'number'
                    ? asyncConfig.pages.maxPageDownloadImg
                    : typeof asyncConfig.pages?.maxPage === 'number'
                        ? asyncConfig.pages.maxPage
                        : 10,
                maxWaiters: typeof asyncConfig.pages?.maxWaiters === 'number' ? asyncConfig.pages.maxWaiters : 50,
                pageLoadWait: typeof asyncConfig.pages?.pageLoadWait === 'number'
                    ? asyncConfig.pages.pageLoadWait
                    : 15000,
            },
        };
    }
    processBrowser(rawConfig) {
        const browserConfig = rawConfig.browser ?? {};
        const fingerprintFile = typeof browserConfig.fingerprintFile === 'string'
            ? this.resolvePath(browserConfig.fingerprintFile)
            : this.resolvePath('./fingerprints/fingerprint.config.json');
        let mode = 'real';
        if (browserConfig.mode !== undefined) {
            if (browserConfig.mode === 'real' || browserConfig.mode === 'fake') {
                mode = browserConfig.mode;
            }
            else {
                throw new Error(`Invalid browser.mode: "${browserConfig.mode}". Allowed: real | fake`);
            }
        }
        return {
            fingerprintFile,
            mode,
            downloadImages: browserConfig.downloadImages ?? true,
        };
    }
    processLogger(rawConfig) {
        const loggerConfig = rawConfig.logger ?? {};
        const transports = Array.isArray(loggerConfig.transports)
            ? loggerConfig.transports.map((transport) => ({
                type: transport.type ?? 'console',
                options: transport.options ?? {},
            }))
            : [
                {
                    type: 'console',
                    options: {},
                },
            ];
        return {
            level: loggerConfig.level ?? 'error',
            transports,
            jsonFormat: loggerConfig.jsonFormat ?? true,
        };
    }
    // ==========================================================
    // Helpers
    // ==========================================================
    resolvePath(value) {
        if (typeof value !== 'string') {
            throw new Error(`Invalid path value: expected string, got ${typeof value}`);
        }
        return path.isAbsolute(value) ? value : path.resolve(this.baseDir, value);
    }
    transportFactories = {
        console: (config) => new ConsoleTransport_1.ConsoleTransport(Boolean(config.options?.pretty)),
        file: (config) => new FileTransport_1.FileTransport(String(config.options?.filePath ?? ''), Boolean(config.options?.pretty)),
    };
    validateUserUrl(value) {
        if (typeof value !== 'string') {
            return null;
        }
        try {
            const url = new URL(value);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
            return url.toString();
        }
        catch {
            return null;
        }
    }
}
exports.AppConfig = AppConfig;
