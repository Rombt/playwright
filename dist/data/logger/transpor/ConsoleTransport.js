"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleTransport = void 0;
class ConsoleTransport {
    write(entry) {
        const output = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}]${entry.contextId ? ` [${entry.contextId}]` : ''} ${entry.message}`;
        console.log(output);
    }
}
exports.ConsoleTransport = ConsoleTransport;
