"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OpenSearchPageStep_1 = require("../steps/openPages/OpenSearchPageStep");
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const OpenProductPageStep_1 = require("../steps/openPages/OpenProductPageStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
const PreparationSearchPageStep_1 = require("../steps/preparationPage/PreparationSearchPageStep");
exports.default = {
    create(deps) {
        // return new PageImageSourceUnderArmour(deps.flowRunner deps.logger);
        return new PageImageSourceUnderArmour(deps.flowRunner);
    },
};
class PageImageSourceUnderArmour {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website === 'https://www.underarmour.com/en-us/search/?q={{sku_prod}}');
    }
    async execute(ctx) {
        const product = ctx.input.product;
        if (!product) {
            throw new Error('Product is missing');
        }
        const sku = ctx.input.product?.sku;
        if (typeof sku !== 'string') {
            throw new Error('Invalid SKU');
        }
        const [left] = sku.split('*');
        const [key, value] = left.split('-');
        ctx.stepParams = new Map([
            [
                OpenSearchPageStep_1.default,
                {
                    clearSku: 'full',
                    nextStep: 'PreparationSearchPageStep',
                },
            ],
            [
                PreparationSearchPageStep_1.default,
                {
                    selector: 'button.uawc-close-button',
                    strategy: 'SimpleClickStrategy',
                },
            ],
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: '[data-testid="product-tile-container"]>a',
                    emptySelector: '[data-testid="empty-search-result"]',
                },
            ],
            [
                OpenProductPageStep_1.default, // переход на страницу варианта
                {
                    strategy: 'GetUrlVariantPageStrategy',
                    key: `dwvar_${key}_color`,
                    value: value,
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
            CollectImgStep_1.default,
            {
                strategy: 'DefaultCollectImagesStrategy',
                stopProcessing: true,
            },
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
        ctx.logger?.debug('Processing of the PageImageSourceUnderArmour is finished', {
            component: 'PageImageSourceUnderArmour',
            method: 'execute()',
            action: 'await this.flowRunner.run(startStep, ctx)',
            data: {
                ctx: ctx,
            },
        });
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
