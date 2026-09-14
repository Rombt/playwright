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
const OpenSearchPageStep_1 = __importDefault(require("../steps/openPages/OpenSearchPageStep"));
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        // return new PageImageSourceLasting(deps.flowRunner deps.logger);
        return new PageImageSourceLasting(deps.flowRunner);
    },
};
class PageImageSourceLasting {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://shambala.com.ua/lasting/#/search/{{sku_prod}}';
    }
    async execute(ctx) {
        if (!ctx.input.sku) {
            throw new Error('SKU is required');
        }
        const clearSku = (0, helpers_1.normalizeSku)(ctx.input.sku);
        ctx.stepParams = new Map([
            [
                OpenSearchPageStep_1.default,
                {
                    strategy: 'WaitForElementOpenSearchPageStrategy',
                    waitForSelector: `div.multi-cell div.multi-item div.multi-content a > span:has-text("${clearSku}")`,
                },
            ],
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
        ctx.logger?.debug('Processing of the PageImageSourceLasting is finished', {
            component: 'PageImageSourceLasting',
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
