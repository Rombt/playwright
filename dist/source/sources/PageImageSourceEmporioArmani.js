"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
const CollectDescriptionStep_1 = require("../steps/collectElements/CollectDescriptionStep");
const PreparationSearchPageStep_1 = require("../steps/preparationPage/PreparationSearchPageStep");
const OpenSearchPageStep_1 = require("../steps/openPages/OpenSearchPageStep");
exports.default = {
    create(deps) {
        return new PageImageSourceEmporioArmani(deps.flowRunner);
    },
};
class PageImageSourceEmporioArmani {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.armani.com/en-wx';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                OpenSearchPageStep_1.default,
                {
                    nextStep: 'PreparationSearchPageStep',
                },
            ],
            [
                PreparationSearchPageStep_1.default,
                {
                    // #ab-header-container > div > div > div.cta-left.hidden.lg\:block > ul > li.list-none > button
                    // openInputSelector: 'button.button-search[aria-label="Search"]',
                    openInputSelector: '#ab-header-container ul [aria-label="Search"]',
                    inputSelector: 'input#search',
                    strategy: 'InsertValueIntoInputStrategy',
                    useWaitForSystemToCoolDown: true,
                    maxDelay: 10000,
                    timeoutMs: 90000,
                    scrollIntoViewIfNeeded: false,
                },
            ],
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'DefaultSearchResultsStrategy',
                    linkSelector: `a[href*="${ctx.input.normalizedSku}"]`,
                    // emptySelector: 'h1',
                    // emptySelectorText: 'Не знайдено жодного товару',
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
        ctx.logger?.debug('Processing of the PageImageSourceEmporioArmani is finished', {
            component: 'PageImageSourceEmporioArmani',
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
