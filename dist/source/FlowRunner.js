"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowRunner = void 0;
class FlowRunner {
    config;
    constructor(config) {
        this.config = config;
    }
    resolveParams(step, ctx, runtimeParams) {
        const map = ctx.stepParams;
        if (!map)
            return runtimeParams;
        const stepCtor = step.constructor;
        // приоритет:
        // 1. runtime params (из next)
        // 2. конкретный шаг
        // 3. глобальные (*)
        if (runtimeParams !== undefined)
            return runtimeParams;
        if (map.has(stepCtor)) {
            return map.get(stepCtor);
        }
        if (map.has('*')) {
            return map.get('*');
        }
        return undefined;
    }
    async run(startStep, ctx) {
        let current = {
            step: startStep,
            params: undefined,
        };
        while (current) {
            if (ctx.control.stop) {
                ctx.logger.warn('Flow stopped manually', {
                    step: current.step.name,
                });
                break;
            }
            const resolvedParams = this.resolveParams(current.step, ctx, current.params);
            ctx.logger.debug('Step start', {
                step: current.step.name,
                stage: 'start',
                params: resolvedParams,
            });
            try {
                await current.step.run(ctx, this.config, resolvedParams);
            }
            catch (error) {
                ctx.logger.error('Step failed', {
                    step: current.step.name,
                    error: {
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
                ctx.errors.push({
                    error: {
                        message: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                    product: ctx.input.product,
                    targetUrl: ctx.state.productUrl,
                });
            }
            ctx.logger.debug('Step finish', {
                step: current.step.name,
                stage: 'finish',
            });
            let next = current.step.next(ctx, this.config);
            if (ctx.control.skipNext && next) {
                ctx.control.skipNext = false;
                next = next.step.next(ctx, this.config);
            }
            current = next;
        }
        ctx.logger.debug('Flow finished', {
            stage: 'done',
        });
    }
}
exports.FlowRunner = FlowRunner;
