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
            this.processResultsFolder.bind(this),
            this.processAsyncRetry.bind(this),
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
        return this.processResultsFolder(this.rawConfig).data?.resultsFolder ?? '';
    }
    get asyncRetry() {
        return (this.processAsyncRetry(this.rawConfig).async ?? { retry: { baseDelay: 100, maxDelay: 5000 } });
    }
    // ==========  методы для обработки полей  ===============
    processResultsFolder(rawConfig) {
        const rawPath = rawConfig?.data?.resultsFolder;
        const resolved = rawPath && typeof rawPath === 'string'
            ? path.isAbsolute(rawPath)
                ? rawPath
                : path.resolve(this.baseDir, rawPath)
            : '';
        return { data: { resultsFolder: resolved } };
    }
    processAsyncRetry(rawConfig) {
        const asyncConfig = rawConfig?.async ?? {};
        const retry = asyncConfig.retry ?? {};
        const baseDelay = typeof retry.baseDelay === 'number' ? retry.baseDelay : 100;
        const maxDelay = typeof retry.maxDelay === 'number' ? retry.maxDelay : 5000;
        return {
            async: {
                retry: {
                    baseDelay,
                    maxDelay,
                },
            },
        };
    }
}
exports.AppConfig = AppConfig;
