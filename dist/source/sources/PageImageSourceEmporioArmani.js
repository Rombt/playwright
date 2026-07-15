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
const PreparationSearchPageStep_1 = __importDefault(require("../steps/preparationPage/PreparationSearchPageStep"));
const OpenSearchPageStep_1 = __importDefault(require("../steps/openPages/OpenSearchPageStep"));
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
                    openInputSelector: '#ab-header-container ul [aria-label="Search"]',
                    inputSelector: 'input#search',
                    strategy: 'InsertValueIntoInputStrategy',
                    useWaitForSystemToCoolDown: true,
                    minFreeMemMB: 800,
                    maxCpuLoad: 0.5,
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
            [
                CheckPageSkuStep_1.default,
                {
                    pageSkuSelector: '#headlessui-dialog-panel-v-0-0-1-0-10 > div.flex-1.overflow-y-auto.positive-padding > div > div:nth-child(4) > div',
                },
            ],
            //
            [SearchGalleryStep_1.default, { gallerySelector: 'div.gallery-slider' }],
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
                        '#headlessui-dialog-panel-v-0-0-1-0-16 > div.flex-1.overflow-y-auto.positive-padding > div',
                    ],
                    removeSelectors: ['h3', 'button', 'xpath=//h3[contains(., "Product code")]/..'],
                    expand: false,
                    separator: '\n',
                    /* если для получения описания на странице нужно кликнуть по табу */
                    //
                    tabSelector: '#pdp-main-block > div.grid-standard.bg-primitives-off-white.giorgioArmaniHeaderPaddingTop.lg:pb-lg.relative.lg:items-start > div.order-3.col-span-full.lg:col-start-10.lg:col-end-13.lg:flex.lg:h-full.lg:flex-col > div > div > div.py-md.flex.h-full.flex-col.justify-between.lg:gap-6.lg:py-0.xl:gap-16 > div > div.flex.flex-col > button:nth-child(1)',
                    tabBodySelector: '#headlessui-dialog-panel-v-0-0-1-0-22',
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
