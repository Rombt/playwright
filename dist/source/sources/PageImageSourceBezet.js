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
        return new PageImageSourceBezet(deps.flowRunner);
    },
};
class PageImageSourceBezet {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.bezet.com.ua/search?s={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: ' div.product > div.image > a',
                    emptySelector: 'body > div.container-fluid.maincatalog.search-results > div:nth-child(2) > div > p > b',
                    emptySelectorText: 'За цим запитом нічого не знайдено',
                },
            ],
            //
            [
                CheckPageSkuStep_1.default,
                { pageSkuSelector: '#single-product > div.row.gallery > div.col-5 > span' },
            ],
            [
                SearchGalleryStep_1.default,
                { gallerySelector: '#single-product > div.row.gallery > div.col-7 > div' },
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
                    containers: ['#desc'],
                    removeSelectors: ['h2'],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceBezet is finished', {
            component: 'PageImageSourceBezet',
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
