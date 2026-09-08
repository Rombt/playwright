"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const OpenSearchPageStep_1 = __importDefault(require("../steps/openPages/OpenSearchPageStep"));
const CheckPageSkuStep_1 = __importDefault(require("../steps/checks/CheckPageSkuStep"));
const SearchGalleryStep_1 = __importDefault(require("../steps/searchElements/SearchGalleryStep"));
const CollectImgStep_1 = __importDefault(require("../steps/collectElements/CollectImgStep"));
const CollectDescriptionStep_1 = __importDefault(require("../steps/collectElements/CollectDescriptionStep"));
exports.default = {
    create(deps) {
        return new PageImageSourceAdidas_2(deps.flowRunner);
    },
};
class PageImageSourceAdidas_2 {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://intertop.ua/ru-ua/search/{{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                OpenSearchPageStep_1.default,
                {
                    nextStep: 'CheckPageSkuStep',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                {
                    pageSkuSelector: 'h1',
                },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: 'section.in-detail-gallery__scroller-wrapper > div.swiper-wrapper',
                },
            ],
            [
                CollectImgStep_1.default,
                {
                    // strategy: 'SlickSliderCollectImagesStrategy',
                    // todo протестить, не всегда собирает
                    strategy: 'DefaultCollectImagesStrategy',
                    stopProcessing: false,
                },
            ],
            [
                CollectDescriptionStep_1.default,
                {
                    containers: ['div.in-product-details-accordion__product-description'],
                    removeSelectors: [],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceAdidas_2 is finished', {
            component: 'PageImageSourceAdidas_2',
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
