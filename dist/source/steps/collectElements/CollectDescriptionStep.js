"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
const helpers_1 = require("../../../common/helpers");
// type CollectDescriptionStepParams = {
//   sku: string;
// };
class CollectDescriptionStep extends BaseStep_1.BaseStep {
    name = 'CollectDescriptionStep';
    async execute(ctx, config) {
        const { page } = ctx;
        let html = '';
        const stepConfig = ctx.stepParams?.get(CollectDescriptionStep);
        if (stepConfig.tabSelector && stepConfig.tabBodySelector) {
            // если селектор не найден весь сценарий не должен упасть
            try {
                await page.locator(stepConfig.tabSelector).click();
                await page.locator(stepConfig.tabBodySelector).waitFor({
                    state: 'visible',
                    timeout: config.asyncRetry.maxDelay,
                });
            }
            catch { }
        }
        try {
            ctx.state.html = await (0, helpers_1.extractRawHtml)(page, stepConfig);
        }
        catch (error) {
            throw new Error(`Description is absent for ${ctx.input.url}`);
        }
        ctx.control.stop = true;
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create(''), //!!!!
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CollectDescriptionStep;
