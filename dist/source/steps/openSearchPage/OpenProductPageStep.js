"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../common/helpers");
class OpenSearchPageStep {
    name = 'OpenSearchPageStep';
    async run(ctx, config, params) {
        const product = params?.product ?? ctx.input.product;
        if (!product) {
            throw new Error('Product is undefined');
        }
        const baseUrl = ctx.task.metadata.target_website;
        if (!baseUrl) {
            throw new Error('target_website is not defined');
        }
        const sku = (0, helpers_1.normalizeSku)(product.sku);
        const url = baseUrl.replace('{{sku_prod}}', sku);
        const waitUntil = params?.waitUntil ?? 'domcontentloaded';
        try {
            await ctx.page.goto(url, { waitUntil });
            ctx.state.productUrl = url;
        }
        catch (error) {
            ctx.errors.push({
                error,
                product,
                targetUrl: url,
            });
            ctx.control.stop = true;
        }
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('CheckSearchResultsStep'),
            params: {
                sku: ctx.input.product?.sku, // runtime-only
            },
        };
    }
}
exports.default = OpenSearchPageStep;
