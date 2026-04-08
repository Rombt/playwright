"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopedLogger = void 0;
class ScopedLogger {
    root;
    contextId;
    constructor(root, contextId) {
        this.root = root;
        this.contextId = contextId;
    }
    error(message, meta) {
        this.log('error', message, meta);
    }
    warn(message, meta) {
        this.log('warn', message, meta);
    }
    info(message, meta) {
        this.log('info', message, meta);
    }
    debug(message, meta) {
        this.log('debug', message, meta);
    }
    log(level, message, meta) {
        const entry = {
            timestamp: new Date(),
            level,
            message,
            contextId: this.contextId,
            meta,
        };
        this.root.write(entry);
    }
    withContext() {
        throw new Error('ScopedLogger context is immutable');
    }
}
exports.ScopedLogger = ScopedLogger;
