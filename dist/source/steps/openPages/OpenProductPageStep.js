"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class OpenProductPageStep extends BaseStep_1.BaseStep {
    name = 'OpenProductPageStep';
    async execute(ctx, config, params) {
        let urlProductPage = ctx.state.urlProductPage;
        if (!urlProductPage) {
            throw new Error('productUrl is not found in state');
        }
        const stepConfig = ctx.stepParams?.get(OpenProductPageStep);
        const strategy = ctx.strategyResolver.get(stepConfig.strategy);
        /** для разных брендов могут понадобится разные стратегии, так для некоторых брендов может
         * понадобится перестраивать urlProductPage под конкретный вариант, например Under Armour
        */
        if (stepConfig.strategy === 'GetUrlVariantPageStrategy') {
            urlProductPage = await strategy.execute(ctx, stepConfig);
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
