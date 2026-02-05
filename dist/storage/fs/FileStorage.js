"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const path = require("path");
const fs = require("fs/promises");
class FileStorage {
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    async save(file) {
        const targetPath = path.join(this.baseDir, file.targetDir, file.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, file.buffer);
    }
    async saveJson(data, options) {
        const targetPath = path.join(this.baseDir, options.targetDir ?? '', options.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    composeFileName() { }
}
exports.FileStorage = FileStorage;
