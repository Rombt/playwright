"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = __importDefault(require("../steps/checks/CheckSearchResultsStep"));
const CheckPageSkuStep_1 = __importDefault(require("../steps/checks/CheckPageSkuStep"));
const SearchGalleryStep_1 = __importDefault(require("../steps/searchElements/SearchGalleryStep"));
const CollectImgStep_1 = __importDefault(require("../steps/collectElements/CollectImgStep"));
const CollectDescriptionStep_1 = __importDefault(require("../steps/collectElements/CollectDescriptionStep"));
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        // return new PageImageSourceLasting_2(deps.flowRunner deps.logger);
        return new PageImageSourceLasting_2(deps.flowRunner);
    },
};
class PageImageSourceLasting_2 {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://shop.lasting.eu/en/index.php?fc=module&module=leoproductsearch&controller=productsearch&search_query={{sku_prod}}');
    }
    async execute(ctx) {
        if (!ctx.input.sku) {
            throw new Error('SKU is required');
        }
        const clearSku = (0, helpers_1.normalizeSku)(ctx.input.sku);
        ctx.stepParams = new Map([
            // [
            //   OpenSearchPageStep,
            //   {
            //     strategy: 'WaitForElementOpenSearchPageStrategy',
            //     waitForSelector: `div.multi-cell div.multi-item div.multi-content a > span:has-text("${clearSku}")`,
            //   },
            // ],
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: `a:has-text("${clearSku}")`,
                    emptySelector: '.multi-noResults:has-text("Нічого не знайдено")',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: `h1:has-text(${clearSku}` }],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: 'div.product__section--gallery > section.gallery',
                },
            ],
            [
                CollectImgStep_1.default,
                {
                    // strategy: 'SlickSliderCollectImagesStrategy',
                    strategy: 'DefaultCollectImagesStrategy',
                    stopProcessing: true,
                },
            ],
            [
                CollectDescriptionStep_1.default,
                {
                    containers: ['div.product-description'],
                    removeSelectors: [],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceLasting_2 is finished', {
            component: 'PageImageSourceLasting_2',
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
