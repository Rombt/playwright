"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class OpenProductPageStep extends BaseStep_1.BaseStep {
    name = 'OpenProductPageStep';
    stepConfig;
    async execute(ctx, config, params) {
        let urlProductPage = ctx.state.urlProductPage;
        if (!urlProductPage) {
            throw new Error('productUrl is not found in state');
        }
        this.stepConfig = ctx.stepParams?.get(OpenProductPageStep);
        const strategy = ctx.strategyResolver.get(this.stepConfig.strategy);
        /** для разных брендов могут понадобится разные стратегии, так для некоторых брендов может
         * понадобится перестраивать urlProductPage под конкретный вариант, например Under Armour
         */
        if (this.stepConfig.strategy === 'GetUrlVariantPageStrategy') {
            urlProductPage = await strategy.execute(ctx, this.stepConfig);
        }
        await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        const nextStep = this.stepConfig.nextStep || 'CheckPageSkuStep';
        return {
            step: ctx.stepFactory.create(nextStep),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = OpenProductPageStep;
