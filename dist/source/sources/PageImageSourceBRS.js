"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
exports.default = {
    create(deps) {
        return new PageImageSourceBRS(deps.flowRunner);
    },
};
class PageImageSourceBRS {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://borsuk.com.ua/katalog/search/?q={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'div.catalogCard-view > a',
                    emptySelector: '[data-catalog-view-block="products"] > p',
                    emptySelectorText: 'Немає товарів',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: 'div.product-header__code' }],
            [SearchGalleryStep_1.default, { gallerySelector: 'div.gallery__photos' }],
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
                    containers: ['.product-description'],
                    removeSelectors: ['a'],
                    expand: false,
                    separator: '\n',
                    /* если для получения описания на странице нужно кликнуть по табу */
                    // tabSelector: '#product_description-tab',
                    // tabBodySelector: '#product_description',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceBRS is finished', {
            component: 'PageImageSourceBRS',
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
