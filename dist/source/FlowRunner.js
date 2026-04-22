"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowRunner = void 0;
class FlowRunner {
    async run(startStep, ctx) {
        let current = startStep;
        while (current) {
            if (ctx.control.stop) {
                ctx.logger.warn('Flow stopped manually', {
                    step: current.name,
                });
                break;
            }
            ctx.logger.debug('Step start', {
                step: current.name,
                stage: 'start',
            });
            try {
                await current.run(ctx);
            }
            catch (error) {
                ctx.logger.error('Step failed', {
                    step: current.name,
                    error,
                });
                ctx.errors.push({
                    error,
                    product: ctx.input.product,
                    targetUrl: ctx.state.productUrl,
                });
                // решение: продолжаем flow
            }
            ctx.logger.debug('Step finish', {
                step: current.name,
                stage: 'finish',
            });
            current = current.next(ctx);
            if (ctx.control.skipNext) {
                ctx.control.skipNext = false;
                current = current?.next(ctx) ?? null;
            }
        }
        ctx.logger.debug('Flow finished', {
            stage: 'done',
        });
    }
}
exports.FlowRunner = FlowRunner;
