"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const path = require("path");
const fs = require("fs/promises");
class FileStorage {
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
    trimNonPrintable(value) {
        return value.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '');
    }
    composeFileName() { }
}
exports.FileStorage = FileStorage;
