"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const ScopedLogger_1 = require("./ScopedLogger");
const ConsoleTransport_1 = require("./transport/ConsoleTransport");
const FileTransport_1 = require("./transport/FileTransport");
const LOG_LEVEL_PRIORITY = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
const TRANSPORTS = [new ConsoleTransport_1.ConsoleTransport(), new FileTransport_1.FileTransport('./logs/app.log')];
class Logger {
    constructor(config) {
        this.level = config.level;
        this.transports = config.transports;
    }
    static init(config) {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        }
        return Logger.instance;
    }
    static getInstance() {
        if (!Logger.instance) {
            throw new Error('Logger is not initialized');
        }
        return Logger.instance;
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
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
            timestamp: new Date(),
            level,
            message,
            meta,
        };
        this.write(entry);
    }
    withContext(contextId) {
        return new ScopedLogger_1.ScopedLogger(this, contextId);
    }
    write(entry) {
        for (const transport of TRANSPORTS) {
            try {
                transport.write(entry);
            }
            catch (err) {
                console.error('Transport error:', err);
            }
        }
    }
    shouldLog(level) {
        return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level];
    }
}
exports.Logger = Logger;
Logger.instance = null;
