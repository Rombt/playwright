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
        return new PageImageSourceAlpineCrown(deps.flowRunner);
    },
};
class PageImageSourceAlpineCrown {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website === 'https://alpine-crown.com/?s={{sku_prod}}&post_type=product');
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            // [
            //   OpenSearchPageStep,
            //   {
            //     nextStep: 'CheckPageSkuStep',
            //   },
            // ],
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    // linkSelector: 'ul.products > li.type-product > a',
                    // linkSelector: `ul.products a:has(img[src*="${ctx.input.sku}"])`,
                    linkSelector: `a:has(> div:first-child img[src*="${ctx.input.sku}"])`,
                    emptySelector: 'div.woocommerce-no-products-found > .woocommerce-info',
                    emptySelectorText: 'Товарів, відповідних вашому запиту, не знайдено',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: 'div.variation-sku > span' }],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: 'div.product-gallery-main-shell > div.swiper-wrapper',
                },
            ],
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
                    containers: [
                        'h3:has-text("Technical specifications") >> ..',
                        'h3:has-text("Технічні характеристики") >> ..',
                    ],
                    removeSelectors: ['h2'],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceAlpineCrown is finished', {
            component: 'PageImageSourceAlpineCrown',
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
