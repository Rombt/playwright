"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../../steps/collectElements/CollectDescriptionStep");
exports.default = {
    create(deps) {
        return new PageImageSourceSalomon(deps.flowRunner);
    },
};
class PageImageSourceSalomon {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://www.sportovna.com.ua/search/?productsPerPage=24&limiter%5Bfulltext%5D={{sku_prod}}');
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'div.card-body > a.s-image-wrapper',
                    emptySelector: 'h1',
                    emptySelectorText: 'Не знайдено жодного товару',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: '[data-product-id]' }],
            [SearchGalleryStep_1.default, { gallerySelector: 'div.s-photo-main' }],
            [
                CollectImgStep_1.default,
                {
                    strategy: 'DefaultCollectImagesStrategy',
                    stopProcessing: false,
                },
            ],
            [
                CollectDescriptionStep_1.default,
                {
                    containers: ['#product_description', '#overview'],
                    removeSelectors: ['h2', 'div.video-container'],
                    expand: false,
                    separator: '\n',
                    /* если для получения описания на странице нужно кликнуть по табу */
                    tabSelector: '#product_description-tab',
                    tabBodySelector: '#product_description',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceSalomon is finished', {
            component: 'PageImageSourceSalomon',
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
