"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTransport = void 0;
const fs = require("fs");
const path = require("path");
class FileTransport {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
        // Создать файл, если не существует
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, '', 'utf8');
        }
    }
    write(entry) {
        const line = JSON.stringify({
            timestamp: entry.timestamp.toISOString(),
            level: entry.level,
            contextId: entry.contextId,
            message: entry.message,
            meta: entry.meta ?? {},
        }) + '\n';
        try {
            fs.appendFileSync(this.filePath, line, 'utf8');
        }
        catch {
            // Logger deliberately swallows transport errors
        }
    }
}
exports.FileTransport = FileTransport;
