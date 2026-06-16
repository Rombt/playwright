"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        // Иногда слайдер лениво подставляет src
        await page.waitForTimeout(ctx.appConfig.asyncRetry.maxDelay);
        const imageUrls = await gallery.evaluate((root) => {
            const imgs = Array.from(root.querySelectorAll('img'));
            const urls = imgs
                .map((img) => {
                const parentLink = img.closest('a');
                const candidates = [
                    parentLink?.getAttribute('href'),
                    img.getAttribute('data-large-image'),
                    img.getAttribute('data-zoom-image'),
                    img.getAttribute('data-lazy'),
                    img.getAttribute('data-original'),
                    img.getAttribute('data-src'),
                    img.getAttribute('src'),
                ];
                return candidates.find((value) => {
                    if (!value) {
                        return false;
                    }
                    const src = value.trim();
                    return src !== '' && !src.startsWith('data:image') && !src.startsWith('blob:');
                });
            })
                .filter((src) => Boolean(src));
            return [...new Set(urls)];
        });
        const absoluteImageUrls = imageUrls.map((src) => new URL(src, page.url()).toString());
        if (absoluteImageUrls.length === 0) {
            throw new Error('No valid image URLs found');
        }
        ctx.logger?.debug('URL of images are received', {
            component: 'CollectImgStep',
            method: 'execute()',
            action: '',
            data: {
                absoluteImageUrls,
            },
        });
        ctx.state.images ??= [];
        return {
            absoluteImageUrls,
        };
    }
}
exports.default = DefaultCollectImagesStrategy;
