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
exports.default = {
    create(deps) {
        // return new PageImageSourceRagnarok(deps.flowRunner deps.logger);
        return new PageImageSourceRagnarok(deps.flowRunner);
    },
};
class PageImageSourceRagnarok {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website === 'https://tactical-belt.store/ru/katalog/search/?q={{sku_prod}}');
    }
    async execute(ctx) {
        const product = ctx.input.product;
        const sku = product.sku;
        const images = {};
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'div.catalogCard-main > div > div.catalogCard-view > a',
                    emptySelector: '[data-catalog-view-block="products"] > p',
                    emptySelectorText: 'Нет товаров',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                {
                    pageSkuSelector: 'div.product-header__code',
                },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: 'div.gallery__photos-container',
                },
            ],
            [
                CollectImgStep_1.default,
                {
                    // strategy: 'SlickSliderCollectImagesStrategy',
                    strategy: 'DefaultCollectImagesStrategy',
                    stopProcessing: false,
                },
            ],
            [
                CollectDescriptionStep_1.default,
                {
                    containers: ['div.product-features'],
                    removeSelectors: [],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceRagnarok is finished', {
            component: 'PageImageSourceRagnarok',
            method: 'execute()',
            action: 'await this.flowRunner.run(startStep, ctx)',
            data: {
                ctx: ctx,
            },
        });
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
