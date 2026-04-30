"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class CollectImgStep extends BaseStep_1.BaseStep {
    name = 'CollectImgStep';
    async execute(ctx, config) {
        const { page } = ctx;
        const stepConfig = ctx.stepParams?.get(CollectImgStep);
        const strategy = ctx.strategyResolver.get(stepConfig.strategy);
        const result = await strategy.execute(ctx, stepConfig);
        if (ctx.state.images === undefined) {
            ctx.state.images = [];
        }
        ctx.state.images?.push(...result.absoluteImageUrls);
        // если источник не содержит описания товаров
        if (stepConfig.stopProcessing === true) {
            ctx.control.stop = true;
        }
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create(''),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CollectImgStep;
