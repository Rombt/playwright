"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// todo подобрать название по лучше!!
class DefaultCollectImagesStrategy {
    name = 'DefaultCollectImagesStrategy';
    // сейчас не использую может в будущих версиях
    async canHandle(ctx) {
        // базовая стратегия — всегда может работать
        return true;
    }
    // сейчас не использую может в будущих версиях
    async score() {
        return 10;
    }
    async execute(ctx) {
        const { page } = ctx;
        const gallery = ctx.state.locatorGallery;
        const imageUrls = await gallery
            .locator('img')
            .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src')).filter(Boolean));
        const absoluteImageUrls = imageUrls.map((src) => new URL(src, page.url()).toString());
        if (absoluteImageUrls.length === 0)
            throw new Error('No valid image URLs found');
        ctx.logger?.debug('URL of images are received', {
            component: 'CollectImgStep',
            method: 'execute()',
            action: '',
            data: {
                absoluteImageUrls: absoluteImageUrls,
            },
        });
        if (!ctx.state.images) {
            ctx.state.images = [];
        }
        return {
            absoluteImageUrls,
        };
    }
}
exports.default = DefaultCollectImagesStrategy;
