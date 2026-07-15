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
        return new PageImageSourceJoma(deps.flowRunner);
    },
};
class PageImageSourceJoma {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://joma.ua/search/?q={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'main > div.categories > div.category > div.category-content > div > a',
                    emptySelector: 'h1',
                    emptySelectorText: 'Не знайдено жодного товару',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                { pageSkuSelector: 'main > div.product > div.product__column.product__column_right > h4' },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: 'main > div.product > div.product__column.product__column_left > div.slider',
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
                        'main > div.product > div.product__column.product__column_left > div.product__description',
                    ],
                    removeSelectors: [],
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
        ctx.logger?.debug('Processing of the PageImageSourceJoma is finished', {
            component: 'PageImageSourceJoma',
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
