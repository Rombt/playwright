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
const _4F_long_sku_json_1 = __importDefault(require("../../data/4F_long_sku.json"));
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        // return new PageImageSource4F(deps.flowRunner deps.logger);
        return new PageImageSource4F_3(deps.flowRunner);
    },
};
class PageImageSource4F_3 {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://sportowestyleb2b.pl/pl/search.html?text={{sku_prod}}');
    }
    async execute(ctx) {
        // т.к. товары ТМ 4F ищутся только по полным squ то нужно получить их все доступные
        // выбрать из них тот частью которого является текущий, короткий, sku и
        // в дальнейшем использовать только длинный
        const arr_longSku = [...new Set(_4F_long_sku_json_1.default)];
        if (!ctx.input.product) {
            throw new Error('!ctx.input.product');
        }
        const shortSku = (0, helpers_1.normalizeSku)(ctx.input.product.sku);
        const foundLongSku = arr_longSku.find((sku) => sku.includes(shortSku));
        if (!foundLongSku) {
            throw new Error('Long sku is not found');
        }
        ctx.input.product.sku = foundLongSku;
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: 'div.search_list__products a.search_top__icon',
                    emptySelector: '#content h3.noproduct__label',
                    emptySelectorText: 'Szukany produkt nie został znaleziony',
                },
            ],
            [CheckPageSkuStep_1.default, { pageSkuSelector: 'h1.product_name__name' }],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: '#photos_slider',
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
            [
                CollectDescriptionStep_1.default,
                {
                    containers: ['#description'],
                    removeSelectors: [''],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSource4F_3 is finished', {
            component: 'PageImageSource4F_3',
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
