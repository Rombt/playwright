"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../../common/helpers");
class DefaultSearchResultsStrategy {
    name = 'DefaultSearchResultsStrategy';
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
        if (!params?.linkSelector) {
            throw new Error('linkSelector is not configured');
        }
        const link = page.locator(params.linkSelector).first();
        // const empty = page.locator(params.emptySelector ?? '.view-empty');
        const empty = params.emptySelectorText
            ? page
                .locator(params.emptySelector ?? '.view-empty')
                .filter({ hasText: params.emptySelectorText })
            : page.locator(params.emptySelector ?? '.view-empty');
        try {
            const result = await Promise.any([
                link
                    .waitFor({ state: 'visible', timeout: ctx.appConfig.asyncRetry.maxDelay })
                    .then(() => 'link'),
                empty
                    .waitFor({ state: 'visible', timeout: ctx.appConfig.asyncRetry.maxDelay })
                    .then(() => 'empty'),
            ]);
        }
        catch {
            throw new Error(`Search result not resolved. ${ctx.input.sku}`);
        }
        if ((await empty.count()) > 0) {
            throw new Error(`Goods not found on the page. ${ctx.input.sku}`);
        }
        return {
            productUrl: await (0, helpers_1.getAbsoluteHref)(ctx.page, link),
        };
    }
}
exports.default = DefaultSearchResultsStrategy;
