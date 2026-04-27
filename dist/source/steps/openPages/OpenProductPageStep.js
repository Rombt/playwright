"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
// type OpenProductPageParams = {
//   product?: IProduct;
// };
class OpenProductPageStep extends BaseStep_1.BaseStep {
    name = 'OpenProductPageStep';
    async execute(ctx, config) {
        const urlProductPage = ctx.state.urlProductPage;
        if (!urlProductPage) {
            throw new Error('productUrl is not found in state');
        }
        await ctx.page.goto(urlProductPage, { waitUntil: 'domcontentloaded' });
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create(''),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = OpenProductPageStep;
