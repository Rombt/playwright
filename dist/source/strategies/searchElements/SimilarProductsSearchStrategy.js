"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../common/helpers");
/**
 * todo
 *  Некоторые сайты на странице результатов поиска вместо надписи типа "товар не найден" выводят похожие продукты
 *  общая стратегия поведение в таких случаях пока не понятна
 *  поэтому накапливаю варианты через if
 *  в дальнейшем построю нормальную стратегию
 */
class SimilarProductsSearchStrategy {
    name = 'SimilarProductsSearchStrategy';
    // сейчас не использую может в будущих версиях
    async canHandle(ctx) {
        const similar = ctx.page.locator('.similar-products');
        return (await similar.count()) > 0;
    }
    // сейчас не использую может в будущих версиях
    async score(ctx) {
        // менее приоритетная стратегия
        return 50;
    }
    async execute(ctx, params) {
        if (!ctx.input.sku || !ctx.input.normalizedSku) {
            throw new Error('SKU or normalizedSku are not defined in context');
        }
        const { page } = ctx;
        let productUrl = '';
        const currentUrl = page.url();
        //todo архитектурная ошибка!
        if (currentUrl.includes('nike.com')) {
            const links = page.locator(params.linkSelector);
            await links.first().waitFor();
            const count = await links.count();
            if (count === 0) {
                throw new Error(`Links to the products do not found on the page. ${ctx.input.sku}`);
            }
            for (let i = 0; i < count; i++) {
                const link = links.nth(i);
                const href = await link.getAttribute('href');
                if (href?.includes(ctx.input.normalizedSku)) {
                    productUrl = await (0, helpers_1.getAbsoluteHref)(ctx.page, link);
                    break;
                }
            }
        }
        if (productUrl === '') {
            throw new Error(`No links contain sku: ${ctx.input.sku}`);
        }
        return {
            productUrl: productUrl,
        };
    }
}
exports.default = SimilarProductsSearchStrategy;
