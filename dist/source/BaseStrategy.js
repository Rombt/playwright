"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStrategy = void 0;
class BaseStrategy {
    async canHandle(_ctx) {
        return true;
    }
    async score(_ctx) {
        return 1;
    }
}
exports.BaseStrategy = BaseStrategy;
