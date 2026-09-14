"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../common/helpers");
class WaitForElementOpenSearchPageStrategy {
    name = 'WaitForElementOpenSearchPageStrategy';
    async canHandle(ctx) {
        return true;
    }
    async score() {
        return 10;
    }
    async execute(ctx, params) {
        const product = ctx.input.product;
        if (!product) {
            throw new Error('Product is undefined');
        }
        const baseUrl = ctx.input.url;
        if (!baseUrl) {
            throw new Error('target_website is not defined');
        }
        const sku = params?.clearSku === 'full' ? (0, helpers_1.fullClearSku)(product.sku) : (0, helpers_1.normalizeSku)(product.sku);
        const url = baseUrl.replace('{{sku_prod}}', sku);
        const waitUntil = params?.waitUntil ?? 'domcontentloaded';
        await (0, helpers_1.optimizePageResources)(ctx);
        await ctx.page.goto(url, {
            waitUntil: 'commit',
        });
        if (params?.waitForSelector) {
            await ctx.page.locator(params.waitForSelector).first().waitFor({
                state: 'attached',
                timeout: ctx.appConfig.asyncRetry.maxDelay,
            });
            await ctx.page.evaluate(() => window.stop());
        }
        else {
            await ctx.page.goto(url, { waitUntil: waitUntil });
        }
    }
}
exports.default = WaitForElementOpenSearchPageStrategy;
