"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class CheckSearchResultsStep extends BaseStep_1.BaseStep {
    name = 'CheckSearchResultsStep';
    constructor() {
        super();
    }
    async execute(ctx, config, params) {
        const stepConfig = ctx.stepParams?.get(CheckSearchResultsStep);
        const strategy = ctx.strategyResolver.get(stepConfig.strategy);
        const result = await strategy.execute(ctx, stepConfig);
        ctx.state.urlProductPage = result.productUrl;
        ctx.logger?.debug('URL product page is received', {
            component: 'CheckSearchResultsStep',
            method: 'execute()',
            action: 'strategy.execute',
            data: {
                strategy: strategy.name,
                _strategy: strategy,
                result: result,
            },
        });
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('OpenProductPageStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CheckSearchResultsStep;
