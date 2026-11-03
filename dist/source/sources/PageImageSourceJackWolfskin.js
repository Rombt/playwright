"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const CheckSearchResultsStep_1 = __importDefault(require("../steps/checks/CheckSearchResultsStep"));
const CheckPageSkuStep_1 = __importDefault(require("../steps/checks/CheckPageSkuStep"));
const SearchGalleryStep_1 = __importDefault(require("../steps/searchElements/SearchGalleryStep"));
const CollectImgStep_1 = __importDefault(require("../steps/collectElements/CollectImgStep"));
const CollectDescriptionStep_1 = __importDefault(require("../steps/collectElements/CollectDescriptionStep"));
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        return new PageImageSourceJackWolfskin(deps.flowRunner);
    },
};
class PageImageSourceJackWolfskin {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.jack-wolfskin.com/search/?q={{sku_prod}}';
    }
    async execute(ctx) {
        if (!ctx.input.product) {
            throw new Error('!ctx.input.product');
        }
        // т.к. товары ТМ JackWolfskin ищутся только по полным squ то нужно получить их все доступные
        // выбрать из них тот частью которого является текущий, короткий, sku и
        // в дальнейшем использовать только длинный
        const filePath = 'src/data/sku/jackWolfskin/jackWolfskin_full_sku.json';
        let arr_longSku = [];
        if ((0, node_fs_1.existsSync)(filePath)) {
            const data = JSON.parse((0, node_fs_1.readFileSync)(filePath, 'utf-8'));
            arr_longSku = [...new Set(data)];
        }
        const shortSku = (0, helpers_1.normalizeSku)(ctx.input.product.sku);
        const foundLongSku = arr_longSku.find((sku) => sku.includes(shortSku));
        if (!foundLongSku) {
            throw new Error('Long sku is not found');
        }
        ctx.input.product.sku = foundLongSku;
        // ctx.logger?.debug('************************', {
        //   component: '',
        //   method: '',
        //   action: '',
        //   data: {
        //     ctxInputProductSku: ctx.input.product.sku,
        //   },
        // });
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: `#voyado-search > div > div.v-grid > div.v-product-card > div.v-image-wrapper > a[href*="${(0, helpers_1.normalizeSku)(ctx.input.product.sku)}" i]`,
                    emptySelector: 'h1',
                    emptySelectorText: 'We’ve got sidetracked somehow',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                {
                    pageSkuSelector: '#ProductInformation-template--27214413037892__main > div > div.group-block-content.layout-panel-flex.layout-panel-flex--column.custom- > div.product-description > details > div > product-article-ref-component > p > span:nth-child(2)',
                },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: '#shopify-section-template--27214413037892__main > div.product-information.section.section--page-width.spacing-style.color-scheme-1.relative > div > div.product-information__media > media-gallery > ul',
                },
            ],
            [
                CollectImgStep_1.default,
                {
                    strategy: 'DefaultCollectImagesStrategy',
                    stopProcessing: true,
                },
            ],
            [
                CollectDescriptionStep_1.default,
                {
                    containers: [''],
                    removeSelectors: [],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceJackWolfskin is finished', {
            component: 'PageImageSourceJackWolfskin',
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
