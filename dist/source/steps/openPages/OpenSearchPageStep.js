"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BaseStep_1 = require("../../BaseStep");
const helpers_1 = require("../../../common/helpers");
class OpenSearchPageStep extends BaseStep_1.BaseStep {
    name = 'OpenSearchPageStep';
    stepConfig;
    async execute(ctx, config, params) {
        const product = params?.product ?? ctx.input.product;
        this.stepConfig = ctx.stepParams?.get(OpenSearchPageStep);
        if (!product) {
            throw new Error('Product is undefined');
        }
        const baseUrl = ctx.task.metadata.target_website;
        if (!baseUrl) {
            throw new Error('target_website is not defined');
        }
        // для некоторых брендов может понадобится более радикальная очистка sku например Under Armour
        let sku = '';
        if (this.stepConfig?.clearSku === 'full') {
            sku = (0, helpers_1.fullClearSku)(product.sku);
        }
        else {
            sku = (0, helpers_1.normalizeSku)(product.sku);
        }
        const url = baseUrl.replace('{{sku_prod}}', sku);
        const waitUntil = params?.waitUntil ?? 'domcontentloaded';
        // для облегчения загрузки страницы отключаю всё не нужное
        await ctx.page.addStyleTag({
            content: `
        *,
        *::before,
        *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `,
        });
        await ctx.page.route('**/*', async (route) => {
            const type = route.request().resourceType();
            if (type === 'image' ||
                type === 'font' ||
                type === 'media' ||
                route.request().resourceType() === 'websocket') {
                await route.abort();
                return;
            }
            await route.continue();
        });
        await ctx.page.route('**/*', async (route) => {
            const url = route.request().url();
            if (url.includes('google-analytics') ||
                url.includes('googletagmanager') ||
                url.includes('facebook.net') ||
                url.includes('fbevents') ||
                url.includes('doubleclick.net') ||
                url.includes('googlesyndication.com') ||
                url.includes('googleadservices.com') ||
                url.includes('hotjar') ||
                url.includes('clarity')) {
                await route.abort();
                return;
            }
            await route.continue();
        });
        await ctx.page.goto(url, { waitUntil });
        // ctx.state.productUrl = url;
    }
    next(ctx) {
        if (ctx.control.stop)
            return null;
        const nextStep = this.stepConfig?.nextStep || 'CheckSearchResultsStep';
        return {
            step: ctx.stepFactory.create(nextStep),
        };
    }
}
exports.default = OpenSearchPageStep;
