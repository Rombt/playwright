"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyStep = void 0;
const BaseStep_1 = require("./BaseStep");
class StrategyStep extends BaseStep_1.BaseStep {
    resolver;
    constructor(resolver) {
        super();
        this.resolver = resolver;
    }
    async execute(ctx, config, params) {
        const strategy = await this.resolver.resolve(ctx, this.name);
        try {
            const result = await strategy.execute(ctx, params);
            await this.afterExecute(ctx, result, strategy, params);
        }
        catch (error) {
            ctx.logger.error('Strategy execution failed', {
                step: this.name,
                strategy: strategy.name,
                error,
            });
            ctx.errors.push({
                error,
                product: ctx.input.product,
                targetUrl: ctx.state.productUrl,
            });
        }
    }
}
exports.StrategyStep = StrategyStep;
