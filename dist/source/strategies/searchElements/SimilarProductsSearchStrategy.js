"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../common/helpers");
class SimilarProductsSearchStrategy {
    name = 'SimilarProductsSearchStrategy';
    async canHandle(ctx) {
        const similar = ctx.page.locator('.similar-products');
        return (await similar.count()) > 0;
    }
    async score(ctx) {
        // менее приоритетная стратегия
        return 50;
    }
    async execute(ctx, params) {
        const similar = ctx.page.locator('.similar-products');
        const items = similar.locator('.product-card');
        const count = await items.count();
        if (!count) {
            throw new Error(`No similar products found. ${params.sku}`);
        }
        const firstItemLink = items.first().locator('a');
        return {
            productUrl: await (0, helpers_1.getAbsoluteHref)(ctx.page, firstItemLink),
        };
    }
}
exports.default = SimilarProductsSearchStrategy;
