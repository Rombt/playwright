"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
const CheckPageSkuStep_1 = require("../steps/checks/CheckPageSkuStep");
const SearchGalleryStep_1 = require("../steps/searchElements/SearchGalleryStep");
const CollectImgStep_1 = require("../steps/collectElements/CollectImgStep");
exports.default = {
    create(deps) {
        return new PageImageSourceNike(deps.flowRunner, deps.logger);
    },
};
class PageImageSourceNike {
    flowRunner;
    logger;
    constructor(flowRunner, logger) {
        this.flowRunner = flowRunner;
        this.logger = logger;
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.nike.com/fi/w?q={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    strategy: 'SimilarProductsSearchStrategy',
                    linkSelector: '#skip-to-products > div > div > figure > a.product-card__img-link-overlay',
                },
            ],
            [
                CheckPageSkuStep_1.default,
                {
                    pageSkuSelector: '#product-description-container > ul > li[data-testid="product-description-style-color"]',
                },
            ],
            [
                SearchGalleryStep_1.default,
                {
                    gallerySelector: 'div[data-testid="ImageCarousel"]',
                },
            ],
            [
                CollectImgStep_1.default,
                {
                    stopProcessing: true,
                },
            ],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
        ctx.logger?.debug('Processing of the PageImageSourceNike is finished', {
            component: 'PageImageSourceNike',
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
