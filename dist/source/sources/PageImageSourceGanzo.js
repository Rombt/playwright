"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        // const startStep = ctx.stepFactory.create('GanzoFlowStep');
        const startStep = ctx.stepFactory.create('OpenSearchPage');
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
