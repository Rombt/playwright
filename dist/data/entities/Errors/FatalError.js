"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FatalError = void 0;
class FatalError extends Error {
    type = 'fatal';
    constructor(message) {
        super(message);
        this.name = 'FatalError';
    }
}
exports.FatalError = FatalError;
