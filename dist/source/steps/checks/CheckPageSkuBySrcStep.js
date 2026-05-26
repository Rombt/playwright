"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
// type CheckPageSkuBySrcParams = {
//   sku: string;
// };
class CheckPageSkuBySrcStep extends BaseStep_1.BaseStep {
    name = 'CheckPageSkuBySrcStep';
    /**
     *
     * @param ctx
     * @param config
     *
     * для валидации полученной страницы продукта используется src картинки слайдера продукта
     */
    async execute(ctx, config) {
        if (!ctx.input.sku || !ctx.input.normalizedSku) {
            throw new Error('SKU or normalizedSku are not defined in context');
        }
        const { page } = ctx;
        const sku = ctx.input.sku;
        const stepConfig = ctx.stepParams?.get(CheckPageSkuBySrcStep);
        const pageSkuSelector = stepConfig?.pageSkuSelector;
        const token = stepConfig?.token;
        if (!pageSkuSelector) {
            throw new Error('pageSkuSelector is not configured in stepParams');
        }
        ctx.logger?.debug('Page sku selector  is received', {
            component: 'CheckPageSkuStep',
            method: 'execute()',
            action: 'ctx.stepParams?.get(CheckPageSkuStep)',
            data: {
                pageSkuSelector: pageSkuSelector,
                token: token,
            },
        });
        let count = 0;
        try {
            const page_sku = page.locator(`${pageSkuSelector}[src*="${token}"]`);
            count = await page_sku.count();
        }
        catch (error) {
            ctx.control.stop = true;
            ctx.logger.error(`Error by match sku ${sku}`, {
                step: this.name,
                count: count,
                error,
            });
        }
        if (count === 0) {
            throw new Error(`The page is not match sku ${sku}`);
        }
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        return {
            step: ctx.stepFactory.create('SearchGalleryStep'),
            params: {
                sku: ctx.input.product?.sku,
            },
        };
    }
}
exports.default = CheckPageSkuBySrcStep;
