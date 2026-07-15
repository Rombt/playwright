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
        return new PageImageSourceNewBalance(deps.flowRunner);
    },
};
class PageImageSourceNewBalance {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://newbalance.ua/store?page=1&s={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'div.product-item__image > a',
                    emptySelector: 'h1 > span',
                    emptySelectorText: '(0)',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: 'div.product-info__code' }],
            [SearchGalleryStep_1.default, { gallerySelector: '#jsProductZoom > div.detail_photos_list' }],
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
                    containers: ['.product-info > section > div.descr-sec__tabs.descr-sec__tabs_full'],
                    removeSelectors: ['button'],
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
        ctx.logger?.debug('Processing of the PageImageSourceNewBalance is finished', {
            component: 'PageImageSourceNewBalance',
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
