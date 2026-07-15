"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OpenSearchPageStep_1 = require("../steps/openPages/OpenSearchPageStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
exports.default = {
    create(deps) {
        return new PageImageSourceAdidas(deps.flowRunner);
    },
};
class PageImageSourceAdidas {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.adidas.ua/search?s={{sku_prod}}';
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
                    pageSkuSelector: 'li.bullets__list--item:has-text("Номер моделі")',
                },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: '#gallery',
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
                    containers: ['#description', '#care', '#bullets'],
                    removeSelectors: ['h2', 'h3', '.description__image', '.button-back care__item--icon'],
                    expand: false,
                    separator: '\n',
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceAdidas is finished', {
            component: 'PageImageSourceAdidas',
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
