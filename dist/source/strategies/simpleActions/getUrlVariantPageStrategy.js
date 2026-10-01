"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FatalError_1 = require("../../../data/entities/Errors/FatalError");
class GetUrlVariantPageStrategy {
    name = 'GetUrlVariantPageStrategy';
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
    async execute(ctx, stepConfig) {
        const originalUrl = ctx.state.urlProductPage;
        if (typeof originalUrl !== 'string') {
            throw new FatalError_1.FatalError('urlProductPage is not a string');
        }
        if (!stepConfig.key || stepConfig.value === undefined) {
            throw new FatalError_1.FatalError('Invalid URL params stepConfig');
        }
        let url;
        try {
            url = new URL(originalUrl);
        }
        catch {
            throw new FatalError_1.FatalError(`Invalid URL: ${originalUrl}`);
        }
        url.searchParams.set(stepConfig.key, stepConfig.value);
        return url.toString();
    }
}
exports.default = GetUrlVariantPageStrategy;
