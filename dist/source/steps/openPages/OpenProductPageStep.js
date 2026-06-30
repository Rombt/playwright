"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
const helpers_1 = require("../../../common/helpers");
class OpenProductPageStep extends BaseStep_1.BaseStep {
    name = 'OpenProductPageStep';
    stepConfig;
    async execute(ctx, config, params) {
        let urlProductPage = ctx.state.urlProductPage;
        if (!urlProductPage) {
            throw new Error('productUrl is not found in state');
        }
        this.stepConfig = ctx.stepParams?.get(OpenProductPageStep);
        if (this.stepConfig?.strategy) {
            const strategy = ctx.strategyResolver.get(this.stepConfig.strategy);
            /**
             * для разных брендов могут понадобится разные стратегии,
             * так для некоторых брендов может понадобится перестраивать urlProductPage
             * под конкретный вариант, например Under Armour
             */
            if (this.stepConfig.strategy === 'GetUrlVariantPageStrategy' && strategy) {
                urlProductPage = await strategy.execute(ctx, this.stepConfig);
            }
        }
        // для облегчения загрузки страницы отключаю всё не нужное
        await (0, helpers_1.optimizePageResources)(ctx);
        await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        const nextStep = this.stepConfig?.nextStep || 'CheckPageSkuStep';
        return {
            step: ctx.stepFactory.create(nextStep),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = OpenProductPageStep;
