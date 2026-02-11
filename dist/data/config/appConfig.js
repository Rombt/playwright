"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfig = void 0;
const fs = require("fs");
const path = require("path");
class AppConfig {
    constructor(configPath = 'config.json') {
        this.baseDir = process.cwd();
        const absolutePath = path.resolve(process.cwd(), configPath);
        this.rawConfig = this.loadConfigFile(absolutePath);
        this.config = this.buildConfig();
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new this();
        }
        return this.instance;
    }
    loadConfigFile(filePath) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw);
        }
        catch {
            return {};
        }
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
            const partial = processor(this.rawConfig);
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
        return this.processData(this.rawConfig).data.resultsFolder;
    }
    get sourcesFolder() {
        return this.processData(this.rawConfig).data.sourcesFolder;
    }
    get asyncRetry() {
        return this.processAsync(this.rawConfig).async.retry;
    }
    get asyncTasks() {
        return this.processAsync(this.rawConfig).async.tasks;
    }
    get asyncPages() {
        return this.processAsync(this.rawConfig).async.pages;
    }
    // ==========  методы для обработки полей  ===============
    processData(rawConfig) {
        const dataConfig = rawConfig?.data ?? {};
        const resolvePath = (value) => typeof value === 'string'
            ? path.isAbsolute(value)
                ? value
                : path.resolve(this.baseDir, value)
            : '';
        return {
            data: {
                resultsFolder: resolvePath(dataConfig.resultsFolder),
                sourcesFolder: resolvePath(dataConfig.sourcesFolder),
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
