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
            await page.locator(stepConfig.tabSelector).click();
            await page.locator(stepConfig.tabBodySelector).waitFor({
                state: 'visible',
                timeout: config.asyncRetry.maxDelay,
            });
        }
        try {
            ctx.state.html = await (0, helpers_1.extractRawHtml)(page, stepConfig);
        }
        catch (error) {
            ctx.logger?.debug('extractRawHtml failed', {
                component: 'ExtractHtmlStep',
                method: 'execute',
                action: 'extractRawHtml',
                data: {
                    error: error instanceof Error ? error.message : error,
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw new Error(`Description is absent for ${ctx.input.sku}`);
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
