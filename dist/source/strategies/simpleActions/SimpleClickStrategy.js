"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class SimpleClickStrategy {
    name = 'SimpleClickStrategy';
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
        try {
            const el = ctx.page.locator(params.selector);
            await el.waitFor({ state: 'visible' });
            await el.click();
            return {
                success: true,
            };
        }
        catch (error) {
            return {
                success: false,
                error,
            };
        }
    }
}
exports.default = SimpleClickStrategy;
