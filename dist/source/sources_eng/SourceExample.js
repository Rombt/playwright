"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceExample = void 0;
class SourceExample {
    engineFactory;
    constructor(engineFactory) {
        this.engineFactory = engineFactory;
    }
    supports(task) {
        return true;
    }
    async execute(ctx) {
        const engine = this.engineFactory(ctx);
        ctx.logger.info('Source execution started', {
            url: ctx.input.url,
            engine: ctx.debug.engine,
        });
        const result = await engine.execute(ctx);
        ctx.logger.info('Source execution finished');
        return result;
    }
}
exports.SourceExample = SourceExample;
