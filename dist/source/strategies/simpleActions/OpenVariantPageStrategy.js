"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class OpenVariantPageStrategy {
    name = 'OpenVariantPageStrategy';
    // сейчас не использую может в будущих версиях
    async canHandle(ctx) {
        const similar = ctx.page.locator('');
        return (await similar.count()) > 0;
    }
    // сейчас не использую может в будущих версиях
    async score(ctx) {
        // менее приоритетная стратегия
        return 50;
    }
    async execute(ctx, params) {
        const Page = ctx.page;
        ctx.logger?.debug('***class OpenVariantPageStrategy', {
            component: '',
            method: 'execute()',
            action: '',
            data: {
                ctx: ctx,
            },
        });
        ;
        return Page;
    }
}
exports.default = OpenVariantPageStrategy;
