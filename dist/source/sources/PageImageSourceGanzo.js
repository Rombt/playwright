"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
exports.default = {
    create(deps) {
        // return new PageImageSourceGanzo(deps.flowRunner deps.logger);
        return new PageImageSourceGanzo(deps.flowRunner);
    },
};
class PageImageSourceGanzo {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    linkSelector: '#block-personal-content > div > div > div > div > div > div > div > div.product-teaser__top > div > div.product-teaser__image--wrapper > a',
                    emptySelector: '.view-empty > p',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                { pageSkuSelector: 'div.product-full__code div.field-product-vendor-code__item' },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: '#block-personal-content > div > div > div > div.product-full__top > div.product-full__top--left.product-full__top-item > div.product-full__gallery.swiper-arrow-style-2.swiper-arrow-style-min > div > div.product-gl__images',
                },
            ],
            [
                CollectDescriptionStep_1.default,
                {
                    containers: ['div.field-product-desc__item.field__item'],
                    removeSelectors: ['h2', 'div.video'],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceGanzo is finished', {
            component: 'PageImageSourceGanzo',
            method: 'execute()',
            action: 'await this.flowRunner.run(startStep, ctx)',
            data: {
                ctx: ctx,
            },
        });
        const product = ctx.input.product;
        const sku = product.sku;
        const images = {};
        if (ctx.state.images?.length) {
            images[sku] = ctx.state.images;
            images[sku].idProduct = product.id_product;
        }
        return {
            data: {
                images,
                html: ctx.state.html,
            },
            errors: ctx.errors,
        };
    }
}
