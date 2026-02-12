"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfig = void 0;
const path = require("path");
const config_1 = require("../../config");
class AppConfig {
    constructor() {
        this.baseDir = process.cwd();
        this.config = this.buildConfig();
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new this();
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
    get resultsFolder() {
        return this.processData(config_1.config).data.resultsFolder;
    }
    get sourcesFolder() {
        return this.processData(config_1.config).data.sourcesFolder;
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
    // ==========  методы для обработки полей  ===============
    processData(rawConfig) {
        const dataConfig = rawConfig?.data ?? {};
        const resolvePath = (value) => typeof value === 'string'
            ? path.isAbsolute(value)
                ? value
                : path.resolve(this.baseDir, value)
            : '';
        const resolveBrands = (value) => Array.isArray(value)
            ? value
                .filter((v) => typeof v === 'string')
                .map(v => v.trim())
                .filter(Boolean)
            : [];
        return {
            data: {
                resultsFolder: resolvePath(dataConfig.resultsFolder),
                sourcesFolder: resolvePath(dataConfig.sourcesFolder),
                brands: resolveBrands(dataConfig.brands),
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
                    maxDelay: typeof retry.maxDelay === 'number' ? retry.maxDelay : 5000,
                    maxRetries: typeof retry.maxRetries === 'number' ? retry.maxRetries : 3,
                },
                tasks: {
                    maxTask: typeof asyncConfig.tasks?.maxTask === 'number' ? asyncConfig.tasks.maxTask : 5,
                },
                pages: {
                    maxPage: typeof asyncConfig.pages?.maxPage === 'number' ? asyncConfig.pages.maxPage : 10,
                },
            },
        };
    }
}
exports.AppConfig = AppConfig;
