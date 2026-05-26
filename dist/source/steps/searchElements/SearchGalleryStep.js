"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
// type SearchGalleryParams = {
//   sku: string;
// };
class SearchGalleryStep extends BaseStep_1.BaseStep {
    name = 'SearchGalleryStep';
    async execute(ctx, config) {
        const { page } = ctx;
        const stepConfig = ctx.stepParams?.get(SearchGalleryStep);
        const gallerySelector = stepConfig?.gallerySelector;
        const gallery = page.locator(gallerySelector);
        try {
            await gallery.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
        }
        catch (error) {
            throw new Error('No gallery found on page');
        }
        const count = await gallery.count();
        if (count === 0)
            throw new Error('No images found on page');
        const firstImg = gallery.locator('img').first();
        await firstImg.waitFor({ state: 'attached', timeout: config.asyncRetry.maxDelay });
        ctx.logger?.debug('The gallery is found', {
            component: 'SearchGalleryStep',
            data: {
                ctx: ctx,
                galleryCount: count,
                gallery: gallery,
            },
        });
        ctx.state.locatorGallery = gallery;
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('CollectImgStep'), //!!!!
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = SearchGalleryStep;
