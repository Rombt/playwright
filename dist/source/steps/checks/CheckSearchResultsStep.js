"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CheckSearchResultsStep {
    name = 'CheckSearchResultsStep';
    async run(ctx, config, params) {
        const { page } = ctx;
        if (!params?.sku) {
            throw new Error('SKU is required');
        }
        const sku = params.sku;
        const stepConfig = ctx.stepParams?.get(CheckSearchResultsStep);
        if (!stepConfig?.linkSelector) {
            throw new Error('linkSelector is not configured in stepParams');
        }
        const link = page.locator(stepConfig.linkSelector).first();
        const empty = page.locator(stepConfig.emptySelector ?? '.view-empty');
        try {
            await Promise.race([
                link.waitFor({ state: 'visible', timeout: config.asyncRetry.maxDelay }),
                empty.waitFor({ state: 'visible', timeout: config.asyncRetry.maxDelay }),
            ]);
        }
        catch {
            throw new Error(`Search result not resolved. ${sku}`);
        }
        if ((await empty.count()) > 0) {
            throw new Error(`Goods not found on the page. ${sku}`);
        }
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('FindProductLinkStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CheckSearchResultsStep;
