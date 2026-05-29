"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
const helpers_1 = require("../../common/helpers");
exports.default = {
    create(deps) {
        // return new PageImageSourcePuma(deps.flowRunner deps.logger);
        return new PageImageSourcePuma(deps.flowRunner);
    },
};
class PageImageSourcePuma {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return (task.metadata.target_website === 'https://ua.puma.com/uk/catalogsearch/result/?q={{sku_prod}}');
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [CheckPageSkuStep_1.default, { pageSkuSelector: 'div.size-cont > div.product-article' }],
            [SearchGalleryStep_1.default,
                { gallerySelector: '#productGallery', },
            ],
            [CollectImgStep_1.default,
                {
                    strategy: 'SlickSliderCollectImagesStrategy',
                    stopProcessing: true,
                }
            ],
            [CollectDescriptionStep_1.default,
                {
                    containers: ['[data-pdp-description-container]'],
                    removeSelectors: ['[data-accordion-header]'],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const product = ctx.input.product;
        let sku = (0, helpers_1.normalizeSku)(product.sku);
        const baseUrl = ctx.task.metadata.target_website;
        if (!baseUrl) {
            throw new Error('target_website is not defined');
        }
        ctx.state.urlProductPage = baseUrl.replace('{{sku_prod}}', sku);
        ctx.input.normalizedSku = sku.slice(0, -2) + '_' + sku.slice(-2);
        const startStep = ctx.stepFactory.create('OpenProductPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourcePuma is finished', {
            component: 'PageImageSourcePuma',
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
