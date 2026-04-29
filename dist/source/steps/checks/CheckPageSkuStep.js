"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class CheckPageSkuStep extends BaseStep_1.BaseStep {
    name = 'CheckPageSkuStep';
    async execute(ctx, config, params) {
        const { page } = ctx;
        if (!params?.sku) {
            throw new Error('SKU is required on the CheckPageSkuStep');
        }
        const sku = params.sku;
        const stepConfig = ctx.stepParams?.get(CheckPageSkuStep);
        const pageSkuSelector = stepConfig?.pageSkuSelector;
        if (!pageSkuSelector) {
            throw new Error('pageSkuSelector is not configured in stepParams');
        }
        ctx.logger?.debug('Pag sku selector  is received', {
            component: 'CheckPageSkuStep',
            method: 'execute()',
            action: 'ctx.stepParams?.get(CheckPageSkuStep)',
            data: {
                pageSkuSelector: pageSkuSelector,
            },
        });
        const page_sku = page.locator(pageSkuSelector, {
            hasText: `${sku}`,
        });
        await page_sku.first().waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
        if ((await page_sku.count()) === 0) {
            throw new Error(`The page is not match sku  ${sku}`);
        }
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('SearchGalleryStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CheckPageSkuStep;
