"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceNewBalance {
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
        return task.metadata.target_website === 'https://newbalance.ua/store?page=1&s={{sku_prod}}';
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
        const data = {};
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const link = page
                .locator('#catalog-list-all > ul > li > div.products__hover > div.product-item__image > a')
                .first();
            await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const href = await link.getAttribute('href');
            if (!href)
                throw new Error('Product link not found');
            await page.goto(href);
            const gallery = page.locator('#jsProductZoom > div.detail_photos_list');
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
            data[sku] = imageUrls;
            data[sku].idProduct = product.id_product;
        }
        catch (err) {
            throw this.buildWorkerError(err, product, url);
        }
        return { data, errors };
    }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceNewBalance;
