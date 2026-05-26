"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class OpenProductPageStep extends BaseStep_1.BaseStep {
    name = 'OpenProductPageStep';
    async execute(ctx, config, params) {
        const urlProductPage = ctx.state.urlProductPage;
        if (!urlProductPage) {
            throw new Error('productUrl is not found in state');
        }
        let page = ctx.page;
        const stepConfig = ctx.stepParams?.get(OpenProductPageStep);
        const strategy = ctx.strategyResolver.get(stepConfig.strategy);
        if (strategy) {
            page = await strategy.execute(ctx, { urlVariantPage: urlProductPage });
        }
        await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('CheckPageSkuStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = OpenProductPageStep;
