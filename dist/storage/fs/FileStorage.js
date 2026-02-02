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
}
exports.FileStorage = FileStorage;
