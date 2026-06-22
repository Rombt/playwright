"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
exports.default = {
    create(deps) {
        return new PageImageSourceColumbia(deps.flowRunner);
    },
};
class PageImageSourceColumbia {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://www.columbia.com/search?q={{sku_prod}}&searchMethod=manualSearch');
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    // #app-main > div > section > div > div > div > a
                    linkSelector: '[data-component-id="product-tile"] > a.chakra-link.product',
                    emptySelector: '[data-testid="sf-product-empty-list-page"] > p.chakra-text.css-hdlnrn',
                    emptySelectorText: 'We couldn’t find anything for',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: `[data-bv-product-id="${ctx.input.normalizedSku}]"` }],
            [SearchGalleryStep_1.default, { gallerySelector: '[data-component-id="image-gallery"]' }],
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
                    containers: ['#accordion-panel-:r20:', '[data-testid="product-details-accordion"]'],
                    removeSelectors: ['h2', 'div.css-i51og3', 'button', 'h4'],
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
        ctx.logger?.debug('Processing of the PageImageSourceColumbia is finished', {
            component: 'PageImageSourceColumbia',
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
