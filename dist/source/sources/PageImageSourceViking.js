"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = __importDefault(require("../steps/checks/CheckSearchResultsStep"));
const CheckPageSkuStep_1 = __importDefault(require("../steps/checks/CheckPageSkuStep"));
const SearchGalleryStep_1 = __importDefault(require("../steps/searchElements/SearchGalleryStep"));
const CollectImgStep_1 = __importDefault(require("../steps/collectElements/CollectImgStep"));
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        // return new PageImageSourceViking(deps.flowRunner deps.logger);
        return new PageImageSourceViking(deps.flowRunner);
    },
};
class PageImageSourceViking {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://viking-europe.com/catalogsearch/result/?q={{sku_prod}}');
    }
    async execute(ctx) {
        const product = ctx.input.product;
        const sku = product.sku;
        const images = {};
        const formattedSku = (0, helpers_1.normalizeSku)(sku).replace(/^(\d{3})(\d{2})(\d+)$/, '$1/$2/$3');
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: `a[data-id*="${formattedSku}"]`,
                    emptySelector: '#toolbar-amount > span:text-matches("^0$")',
                },
            ],
            [CheckPageSkuStep_1.default, {
                    pageSkuSelector: 'div.product.attribute.sku > div.value',
                    formattedSku: formattedSku,
                }],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: '[data-gallery-role="gallery"]',
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
            // [
            //   CollectDescriptionStep,
            //   {
            //     containers: ['div.field-product-desc__item.field__item'],
            //     removeSelectors: ['h2', 'div.video'],
            //     expand: false,
            //     separator: '\n',
            //   } satisfies IExtractHtmlOptions,
            // ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceViking is finished', {
            component: 'PageImageSourceViking',
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
