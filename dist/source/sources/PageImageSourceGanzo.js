"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CheckSearchResultsStep_1 = require("../steps/checks/CheckSearchResultsStep");
exports.default = {
    create(deps) {
        // return new PageImageSourceGanzo(deps.flowRunner deps.logger);
        return new PageImageSourceGanzo(deps.flowRunner);
    },
};
class PageImageSourceGanzo {
    flowRunner;
    constructor(flowRunner) {
        this.flowRunner = flowRunner;
    }
    supports(task) {
        return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
    }
    async execute(ctx) {
        ctx.stepParams = new Map([
            [
                CheckSearchResultsStep_1.default,
                {
                    // linkSelector:
                    //   '#block-personal-content > div > div > div > div > div > div > div > div.product-teaser__top > div > div.product-teaser__image--wrapper > a',
                    emptySelector: '.view-empty > p',
                },
            ],
            // [ExtractImagesStep, { format: 'webp' }],
            // [SaveStep, { compress: true }],
            // ['*', { retry: 2 }], // глобальный fallback
        ]);
        // const startStep = ctx.stepFactory.create('GanzoFlowStep');
        const startStep = ctx.stepFactory.create('OpenSearchPageStep');
        await this.flowRunner.run(startStep, ctx);
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
