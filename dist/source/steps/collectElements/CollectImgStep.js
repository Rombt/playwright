"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class CollectImgStep extends BaseStep_1.BaseStep {
    name = 'CollectImgStep';
    async execute(ctx, config) {
        const { page } = ctx;
        const stepConfig = ctx.stepParams?.get(CollectImgStep);
        // !! в самом начале на случай ошибок в стратегиях
        if (stepConfig.stopProcessing === true) {
            ctx.control.stop = true;
        }
        const strategy = ctx.strategyResolver.get(stepConfig.strategy);
        const result = await strategy.execute(ctx);
        if (ctx.state.images === undefined) {
            ctx.state.images = [];
        }
        ctx.state.images?.push(...result.absoluteImageUrls);
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('CollectDescriptionStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CollectImgStep;
