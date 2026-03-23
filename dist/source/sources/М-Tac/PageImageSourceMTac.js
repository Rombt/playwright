"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appConfig_1 = require("../../../data/config/appConfig");
class PageImageSourceMTac {
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.mtac.ua/search/?query={{sku_prod}}';
    }
    async worker(targetUrl, page, limiter, getNext, loggerScope, sku, debugMeta) {
        const results = [];
        let product;
        if (typeof getNext === 'function') {
            product = getNext();
        }
        else if (getNext) {
            product = getNext;
        }
        if (!product) {
            throw new Error('Product is undefined');
        }
        loggerScope?.debug('Worker initialized with valid product', {
            component: 'DPageImageSourceColumbia',
            method: 'worker(...)',
            data: {
                targetUrl: targetUrl,
                page: page,
                product: product,
                limiter: limiter,
                sku: sku,
                debugMeta: debugMeta,
            },
        });
        results.push(await this.execute(targetUrl, page, product));
        return results;
    }
    async execute(targetUrl, page, product) {
        const errors = [];
        const images = {};
        let html;
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const image = page.locator('div.goods-top-block > div.goods-image > a').first(); //todo может быть много на странице получить и обработать все
            await image.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            await image.click();
            const gallery = page.locator('div.product__main-slider.flex > div > div > div');
            // html = await page.locator('#uk-tab-2 > div').evaluate((el) => el.innerHTML);
            html = await page.$eval('#uk-tab-2 > div.product-property', (el) => el.innerHTML);
            try {
                await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            }
            catch (error) {
                throw new Error('No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            const firstImg = gallery.locator('img').first();
            await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const imageUrls = await gallery
                .locator('img')
                .evaluateAll((imgs) => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map((img) => img.src));
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            images[sku] = imageUrls;
            images[sku].idProduct = product.id_product;
        }
        catch (err) {
            await page.screenshot({ path: `debug_photo/debug_${sku}.png`, fullPage: true });
            throw this.buildWorkerError(err, product, url);
        }
        return {
            data: {
                images,
                html,
            },
            errors,
        };
    }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceMTac;
