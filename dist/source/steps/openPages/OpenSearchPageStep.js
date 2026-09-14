"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class OpenSearchPageStep extends BaseStep_1.BaseStep {
    name = 'OpenSearchPageStep';
    async execute(ctx, config, params) {
        const stepConfig = ctx.stepParams?.get(OpenSearchPageStep) ?? params;
        console.log('stepConfig:', stepConfig);
        const strategyName = stepConfig?.strategy || 'DefaultOpenSearchPageStrategy';
        const strategy = ctx.strategyResolver.get(strategyName);
        await strategy.execute(ctx, stepConfig);
        ctx.logger?.debug('Search page opened', {
            component: 'OpenSearchPageStep',
            method: 'execute()',
            action: 'strategy.execute',
            data: {
                strategy: strategy.name,
            },
        });
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        const stepConfig = ctx.stepParams?.get(OpenSearchPageStep);
        return {
            step: ctx.stepFactory.create(stepConfig?.nextStep || 'CheckSearchResultsStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = OpenSearchPageStep;
