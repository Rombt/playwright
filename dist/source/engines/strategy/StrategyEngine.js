"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyEngine = void 0;
class StrategyEngine {
    async execute(ctx) {
        // сюда переносишь текущий pipeline + resolver + стратегии
        ctx.logger.warn('StrategyEngine is not implemented yet');
        if (!ctx.state.result) {
            throw new Error('StrategyEngine: result is not set');
        }
        return ctx.state.result;
    }
}
exports.StrategyEngine = StrategyEngine;
