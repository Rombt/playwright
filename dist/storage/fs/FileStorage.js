"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
class FileStorage {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    async save(file, loggerScope) {
        const targetPath = path.join(this.trimNonPrintable(this.baseDir), this.trimNonPrintable(file.targetDir), this.trimNonPrintable(file.filename));
        loggerScope?.debug(`Entering FileStorage.save()`, {
            component: 'FileStorage',
            method: 'save()',
            action: 'start',
            data: {
                targetPath: targetPath,
                file: file,
            },
        });
        try {
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, file.buffer);
            loggerScope?.debug(`File saved successfully`, {
                component: 'FileStorage',
                method: 'save()',
                action: 'fs.writeFile(...)',
                data: {
                    targetPath: targetPath,
                    file: file,
                },
            });
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            loggerScope?.error(`Failed to save file`, {
                component: 'FileStorage',
                method: 'save()',
                action: 'fs.writeFile(...)',
                data: {
                    targetPath: targetPath,
                    file: file,
                    errorName: error instanceof Error ? error.name : undefined,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw err;
        }
    }
    async saveJson(data, options) {
        const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    async appendJsonUnique(data, options) {
        const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        let existingData = [];
        try {
            const content = await fs.readFile(targetPath, 'utf-8');
            existingData = JSON.parse(content);
        }
        catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            // если файла нет — оставляем пустой массив
        }
        // Создаём карту по sku для быстрого поиска
        const existingMap = new Map(existingData.map((item) => [item.sku, item]));
        // Добавляем только новых
        for (const item of data) {
            if (!existingMap.has(item.sku)) {
                existingData.push(item);
                existingMap.set(item.sku, item);
            }
        }
        await fs.writeFile(targetPath, JSON.stringify(existingData, null, 2), 'utf-8');
    }
    trimNonPrintable(value) {
        return value.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '');
    }
    async appendJsonDeep(data, options) {
        const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        let existingData = {};
        try {
            const fileContent = await fs.readFile(targetPath, 'utf-8');
            if (fileContent.trim()) {
                existingData = JSON.parse(fileContent);
            }
        }
        catch {
            // ignore
        }
        const merged = this.deepMergeSafe(existingData, data);
        await fs.writeFile(targetPath, JSON.stringify(merged, null, 2), 'utf-8');
    }
    deepMergeSafe(target, source) {
        // если нет одного из значений
        if (target === undefined)
            return source;
        if (source === undefined)
            return target;
        // массивы → дописываем
        if (Array.isArray(target) && Array.isArray(source)) {
            return [...target, ...source];
        }
        // оба объекта → merge
        if (this.isObject(target) && this.isObject(source)) {
            const result = { ...target };
            for (const key of Object.keys(source)) {
                result[key] = this.deepMergeSafe(target[key], source[key]);
            }
            return result;
        }
        // ❗ КЛЮЧЕВОЙ МОМЕНТ
        // если типы разные — НЕ трогаем target
        if (typeof target !== typeof source) {
            return target;
        }
        // если одинаковый тип → обновляем
        return source;
    }
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    composeFileName() { }
}
exports.FileStorage = FileStorage;
