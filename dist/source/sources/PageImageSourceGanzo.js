"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GanzoFlowStep_1 = require("../steps/GanzoFlowStep");
exports.default = {
    create(deps) {
        return new PageImageSourceGanzo(deps.flowRunner, deps.actionsFactory, deps.logger);
    },
};
class PageImageSourceGanzo {
    flowRunner;
    actionsFactory;
    logger;
    constructor(flowRunner, actionsFactory, logger) {
        this.flowRunner = flowRunner;
        this.actionsFactory = actionsFactory;
        this.logger = logger;
    }
    supports(task) {
        return task.metadata.target_website === 'https://ganzo.ua/search?search={{sku_prod}}';
    }
    async execute(ctx) {
        const startStep = new GanzoFlowStep_1.GanzoFlowStep(this.actionsFactory);
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
