"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
const FatalError_1 = require("../../../data/entities/Errors/FatalError");
class CheckPageSkuStep extends BaseStep_1.BaseStep {
    name = 'CheckPageSkuStep';
    async execute(ctx, config) {
        if (!ctx.input.sku || !ctx.input.normalizedSku) {
            throw new FatalError_1.FatalError('SKU or normalizedSku are not defined in context');
        }
        const { page } = ctx;
        const stepConfig = ctx.stepParams?.get(CheckPageSkuStep);
        const pageSkuSelector = stepConfig?.pageSkuSelector;
        const formattedSku = stepConfig?.formattedSku;
        if (!pageSkuSelector) {
            throw new FatalError_1.FatalError('pageSkuSelector is not configured in stepParams');
        }
        ctx.logger?.debug('Page sku selector  is received', {
            component: 'CheckPageSkuStep',
            method: 'execute()',
            action: 'ctx.stepParams?.get(CheckPageSkuStep)',
            data: {
                ctx: ctx,
                pageSkuSelector: pageSkuSelector,
                ctxInputNormalizedSku: ctx.input.normalizedSku,
                formattedSku: formattedSku,
            },
        });
        const pageSku = page.locator(pageSkuSelector);
        await pageSku.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
        // await pageSku.scrollIntoViewIfNeeded();
        const text = await pageSku.textContent();
        let sku = '';
        // если sku на странице представлено в оригинальном виде. Как здесь на пример https://viking-europe.com/bielizna-damska-viking-etna-2-0-lady-pants-bamboo-czarno-fioletowa-500-27-6048-0948/
        if (formattedSku) {
            sku = formattedSku;
        }
        else {
            sku = ctx.input.normalizedSku;
        }
        try {
            if (!text?.toLowerCase().includes(sku.toLowerCase())) {
                throw new FatalError_1.FatalError(`SKU mismatch. Expected: ${sku}, found: ${text}`);
            }
        }
        catch (e) {
            ctx.control.stop = true;
            throw new FatalError_1.FatalError(`The page is not match sku ${sku}`);
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
