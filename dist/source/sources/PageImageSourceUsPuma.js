"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = __importDefault(require("../steps/checks/CheckSearchResultsStep"));
const CheckPageSkuStep_1 = __importDefault(require("../steps/checks/CheckPageSkuStep"));
const SearchGalleryStep_1 = __importDefault(require("../steps/searchElements/SearchGalleryStep"));
const CollectImgStep_1 = __importDefault(require("../steps/collectElements/CollectImgStep"));
// import CollectDescriptionStep from '../steps/collectElements/CollectDescriptionStep';
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        // return new PageImageSourceUsPuma(deps.flowRunner deps.logger);
        return new PageImageSourceUsPuma(deps.flowRunner);
    },
};
class PageImageSourceUsPuma {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://us.puma.com/us/en/search?q={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.logger?.debug('00 Processing of the PageImageSourceUsPuma', {
            component: 'PageImageSourceUsPuma',
            method: 'execute()',
            action: 'await this.flowRunner.run(startStep, ctx)',
            data: {
                ctx: ctx,
            },
        });
        const product = ctx.input.product;
        let sku = (0, helpers_1.normalizeSku)(product.sku);
        const baseUrl = ctx.task.metadata.target_website;
        if (!baseUrl) {
            throw new Error('target_website is not defined');
        }
        ctx.state.urlProductPage = baseUrl.replace('{{sku_prod}}', sku);
        ctx.input.normalizedSku = sku.slice(0, -2) + '_' + sku.slice(-2);
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: `li[data-product-id="${ctx.input.normalizedSku}"] > div > a`,
                    emptySelector: 'h1',
                    emptySelectorText: "Sorry, we couldn't find what you are looking for.",
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: `li:has-text("Style: ${ctx.input.normalizedSku}")` }],
            [SearchGalleryStep_1.default, { gallerySelector: '#product-gallery' }],
            [
                CollectImgStep_1.default,
                {
                    // strategy: 'SlickSliderCollectImagesStrategy',
                    strategy: 'DefaultCollectImagesStrategy',
                    stopProcessing: true,
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceUsPuma is finished', {
            component: 'PageImageSourceUsPuma',
            method: 'execute()',
            action: 'await this.flowRunner.run(startStep, ctx)',
            data: {
                ctx: ctx,
            },
        });
        sku = product.sku;
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
