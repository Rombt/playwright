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
        // return new PageImageSourceKelme(deps.flowRunner deps.logger);
        return new PageImageSourceKelme(deps.flowRunner);
    },
};
class PageImageSourceKelme {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://kelme.ua/?s={{sku_prod}}';
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
                    linkSelector: `body > div.pb-5 > div > div > div.col-12.col-sm-10.col-md-9.col-lg-10 > h4 > a`,
                    emptySelector: '.container > p',
                    emptySelectorText: 'Пошук не дав результатів.',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                {
                    pageSkuSelector: 'body > div.sec24.pb-3.pb-lg-5 > div > div > div.col-12.col-md-6.col-xl-5.offset-xl-1.sec24_card > p:nth-child(5)',
                },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: '#insertGallery > div.swiper-container.gallery-top.swiper-container-initialized.swiper-container-horizontal',
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
                    containers: ['body > div.sec25 > div > div'],
                    removeSelectors: [],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceKelme is finished', {
            component: 'PageImageSourceKelme',
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
