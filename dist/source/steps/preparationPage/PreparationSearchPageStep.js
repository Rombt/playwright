"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class PreparationSearchPageStep extends BaseStep_1.BaseStep {
    name = 'PreparationSearchPageStep';
    constructor() {
        super();
    }
    async execute(ctx, config, params) {
        const stepConfig = ctx.stepParams?.get(PreparationSearchPageStep);
        const strategy = ctx.strategyResolver.get(stepConfig.strategy);
        // todo пока не понятно что именно делать с результатами простого действия
        const result = await strategy.execute(ctx, stepConfig);
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('CheckSearchResultsStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = PreparationSearchPageStep;
