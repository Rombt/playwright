"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
class CollectImgStep extends BaseStep_1.BaseStep {
    name = 'CollectImgStep';
    async execute(ctx, config) {
        const { page } = ctx;
        const stepConfig = ctx.stepParams?.get(CollectImgStep);
        // todo
        // const strategy = ctx.strategyResolver.get<CheckSearchResultsParams, SearchResult>(
        //   stepConfig.strategy,
        // );
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
        ctx.state.images?.push(...absoluteImageUrls);
        // если источник не содержит описания товаров
        if (stepConfig.stopProcessing === true) {
            ctx.control.stop = true;
        }
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create(''),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CollectImgStep;
