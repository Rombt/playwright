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
        return new PageImageSourceFenix(deps.flowRunner);
    },
};
class PageImageSourceFenix {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://fenix.ua/ua/search/?query={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'div.card-body > a.s-image-wrapper',
                    emptySelector: 'h1',
                    emptySelectorText: 'Не знайдено жодного товару',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: 'div.s-product-sku > span.s-product-sku__sku' }],
            [SearchGalleryStep_1.default, { gallerySelector: 'div.s-photo-main' }],
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
                    containers: ['#product_description', '#overview'],
                    removeSelectors: ['h2', 'div.video-container'],
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
        ctx.logger?.debug('Processing of the PageImageSourceFenix is finished', {
            component: 'PageImageSourceFenix',
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
