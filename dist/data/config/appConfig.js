"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfig = void 0;
const path = require("path");
const config_1 = require("../../config");
const ConsoleTransport_1 = require("../logger/transport/ConsoleTransport");
const FileTransport_1 = require("../logger/transport/FileTransport");
class AppConfig {
    static instance;
    rawConfig;
    config;
    baseDir;
    constructor() {
        this.baseDir = process.cwd();
        this.config = this.buildConfig();
    }
    //todo добавить путь к файлу конфига при инициализации и оставить import { config as appConfig } from '../../config'; по дефолту
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
    /** Применение processors и нормализация */
    buildConfig() {
        let result = {};
        const processors = [
            this.processData.bind(this),
            this.processAsync.bind(this),
            // сюда добавлять методы для обработки новых полей
        ];
        for (const processor of processors) {
            const partial = processor(config_1.config);
            result = this.merge(result, partial);
        }
        return result;
    }
    /** Простой merge для частичных результатов processors */
    merge(target, source) {
        return {
            ...target,
            ...source,
            ...(source.data ? { data: { ...target.data, ...source.data } } : {}),
        };
    }
    // ========= геттеры =========================
    /** Получить готовый конфиг */
    get get() {
        return this.config;
    }
    get scenario() {
        return this.processData(config_1.config).data.scenario ?? 'default';
    }
    get resultsFolder() {
        return this.processData(config_1.config).data.resultsFolder;
    }
    get sourcesFolder() {
        return this.processData(config_1.config).data.sourcesFolder;
    }
    get taskPath() {
        return this.processData(config_1.config).data.taskPath;
    }
    get convertToJpg() {
        return this.processData(config_1.config).data.convertToJpg;
    }
    get brands() {
        return this.processData(config_1.config).data.brands;
    }
    get asyncRetry() {
        return this.processAsync(config_1.config).async.retry;
    }
    get asyncTasks() {
        return this.processAsync(config_1.config).async.tasks;
    }
    get asyncPages() {
        return this.processAsync(config_1.config).async.pages;
    }
    get fingerprintFile() {
        return this.processBrowser(config_1.config).browser.fingerprintFile;
    }
    get browserMode() {
        return this.processBrowser(config_1.config).browser.mode;
    }
    get downloadImages() {
        return this.processBrowser(config_1.config).browser.downloadImages;
    }
    get loggerConfig() {
        return this.processLogger(config_1.config).logger;
    }
    get loggerTransports() {
        const transports = [];
        const config = this.loggerConfig;
        for (const t of config.transports ?? []) {
            const factory = this.transportFactories[t.type];
            if (factory) {
                transports.push(factory(t));
            }
        }
        return transports;
    }
    // ==========  методы для обработки полей  ===============
    processData(rawConfig) {
        const dataConfig = rawConfig?.data ?? {};
        const resolveBrands = (value) => Array.isArray(value)
            ? value
                .filter((v) => typeof v === 'string')
                .map((v) => v.trim())
                .filter(Boolean)
            : [];
        return {
            data: {
                resultsFolder: this.resolvePath(dataConfig.resultsFolder),
                sourcesFolder: this.resolvePath(dataConfig.sourcesFolder),
                convertToJpg: dataConfig.convertToJpg ?? false,
                brands: resolveBrands(dataConfig.brands),
                taskPath: this.resolvePath(dataConfig.taskPath),
                scenario: typeof dataConfig.scenario === 'string' ? dataConfig.scenario : 'default',
            },
        };
    }
    processAsync(rawConfig) {
        const asyncConfig = rawConfig?.async ?? {};
        const retry = asyncConfig.retry ?? {};
        return {
            async: {
                retry: {
                    baseDelay: typeof retry.baseDelay === 'number' ? retry.baseDelay : 100,
                    maxDelay: typeof retry.maxDelay === 'number' ? retry.maxDelay : 3000,
                    maxWaitForFreePage: typeof retry.maxWaitForFreePage === 'number' ? retry.maxWaitForFreePage : 60000,
                    maxRetries: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
                    maxAttempts: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
                },
                tasks: {
                    maxTask: typeof asyncConfig.tasks?.maxTask === 'number' ? asyncConfig.tasks.maxTask : 5,
                },
                pages: {
                    maxPage: typeof asyncConfig.pages?.maxPage === 'number' ? asyncConfig.pages.maxPage : 10,
                    maxPageDownloadImg: asyncConfig.pages?.maxPageDownloadImg ?? asyncConfig.pages?.maxPage ?? 10,
                    maxWaiters: typeof asyncConfig.pages?.maxWaiters === 'number' ? asyncConfig.pages.maxWaiters : 50,
                    pageLoadWait: typeof asyncConfig.pages?.pageLoadWait === 'number'
                        ? asyncConfig.pages.pageLoadWait
                        : 15000,
                },
            },
        };
    }
    processBrowser(rawConfig) {
        const browserConfig = rawConfig?.browser ?? {};
        // --- fingerprintFile ---
        const fingerprintFile = browserConfig.fingerprintFile
            ? this.resolvePath(browserConfig.fingerprintFile)
            : this.resolvePath('./fingerprints/fingerprint.config.json');
        // --- mode ---
        let mode = 'real';
        if (browserConfig.mode !== undefined) {
            if (browserConfig.mode === 'real' || browserConfig.mode === 'fake') {
                mode = browserConfig.mode;
            }
            else {
                throw new Error(`Invalid browser.mode: "${browserConfig.mode}". Allowed: real | fake`);
            }
        }
        // --- downloadImages ---
        const downloadImages = browserConfig.downloadImages ?? true;
        return {
            browser: {
                fingerprintFile,
                mode,
                downloadImages,
            },
        };
    }
    processLogger(rawConfig) {
        const loggerConfig = rawConfig?.logger ?? {};
        const transports = Array.isArray(loggerConfig.transports)
            ? loggerConfig.transports.map((t) => ({
                type: typeof t.type === 'string' ? t.type : 'console',
                options: t.options ?? {},
            }))
            : [{ type: 'console', options: {} }]; // дефолтный transport
        return {
            logger: {
                level: typeof loggerConfig.level === 'string' ? loggerConfig.level : 'error',
                transports,
                jsonFormat: loggerConfig.jsonFormat !== false,
            },
        };
    }
    //==========  helpers ========
    resolvePath(value) {
        if (typeof value !== 'string') {
            throw new Error(`Invalid path value: expected string, got ${typeof value}`);
        }
        return path.isAbsolute(value) ? value : path.resolve(this.baseDir, value);
    }
    transportFactories = {
        console: (config) => new ConsoleTransport_1.ConsoleTransport(config.options.pretty),
        file: (config) => {
            return new FileTransport_1.FileTransport(config.options.filePath, config.options.pretty);
        },
    };
    validateUserUrl(value) {
        if (typeof value !== 'string')
            return null;
        try {
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol)) {
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
