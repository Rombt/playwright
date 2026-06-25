"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../common/helpers");
const helpers_2 = require("../../../common/helpers");
class FuzzyProductNameSearchResultsStrategy {
    name = 'FuzzyProductNameSearchResultsStrategy';
    // сейчас не использую может в будущих версиях
    async canHandle(ctx) {
        // базовая стратегия — всегда может работать
        return true;
    }
    // сейчас не использую может в будущих версиях
    async score() {
        return 10;
    }
    async execute(ctx, params) {
        const { page } = ctx;
        if (!ctx.input.product?.name_product) {
            throw new Error(`Product name is missing for SKU: ${ctx.input.sku ?? 'unknown'}`);
        }
        const cleanProdName = ctx.input.product?.name_product?.replace(ctx.input.sku ?? '', '').trim();
        const link = page.locator(params.linkSelector).first();
        if ((await link.count()) == 0) {
            throw new Error(`The link selector not found on the page. ${ctx.input.sku}`);
        }
        const linkText = await link.innerText();
        const productMatch = (0, helpers_2.fuzzyMatchStrings)({
            a: cleanProdName,
            b: linkText,
            threshold: 0.4555,
        });
        if (!productMatch.match) {
            throw new Error(`Goods not found on the page. ${ctx.input.sku}`);
        }
        return {
            productUrl: await (0, helpers_1.getAbsoluteHref)(ctx.page, link),
        };
    }
}
exports.default = FuzzyProductNameSearchResultsStrategy;
