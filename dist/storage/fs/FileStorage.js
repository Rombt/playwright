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
        const targetPath = path.join(this.baseDir, file.filename);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(file.path, targetPath);
        // опционально: очистка tmp
        await fs.unlink(file.path);
    }
}
exports.FileStorage = FileStorage;
