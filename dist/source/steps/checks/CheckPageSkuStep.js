"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class CheckPageSkuStep extends BaseStep_1.BaseStep {
    name = 'CheckPageSkuStep';
    async execute(ctx, config) {
        if (!ctx.input.sku || !ctx.input.normalizedSku) {
            throw new Error('SKU or normalizedSku are not defined in context');
        }
        const { page } = ctx;
        const sku = ctx.input.sku;
        const stepConfig = ctx.stepParams?.get(CheckPageSkuStep);
        const pageSkuSelector = stepConfig?.pageSkuSelector;
        if (!pageSkuSelector) {
            throw new Error('pageSkuSelector is not configured in stepParams');
        }
        ctx.logger?.debug('Page sku selector  is received', {
            component: 'CheckPageSkuStep',
            method: 'execute()',
            action: 'ctx.stepParams?.get(CheckPageSkuStep)',
            data: {
                pageSkuSelector: pageSkuSelector,
            },
        });
        try {
            const page_sku = page.locator(pageSkuSelector, {
                hasText: `${ctx.input.normalizedSku}`,
            });
            await page_sku.first().waitFor({
                state: 'attached',
                timeout: config.asyncRetry.maxDelay,
            });
        }
        catch {
            ctx.control.stop = true;
            throw new Error(`The page is not match sku ${sku}`);
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
