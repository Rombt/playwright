"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
class PageImageSourceRozetka {
    supports(task) {
        return task.type === 'recollect-product-photos';
    }
    async workerHttpRequest(request, headers, targetUrl, limiter, getNext) {
        const results = [];
        while (true) {
            const product = getNext();
            if (!product)
                break;
            const rawSku = product.sku;
            const starIndex = rawSku.indexOf('*');
            const sku = (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '') ?? '';
            const options = {
                url: targetUrl,
                params: {
                    country: 'UA',
                    lang: 'ua',
                    text: sku,
                },
                headers: headers,
            };
            await limiter.wait();
            const requestResult = await this.executeHttpRequest(request, options);
            results.push(requestResult);
        }
        return results;
    }
    async executeHttpRequest(request, options) {
        const limiter = new RateLimiter_1.RateLimiter(5000);
        try {
            const response = await request.get(options.url, {
                params: options.params,
                headers: options.headers,
            });
            const status = response.status();
            if (status === 429 || status === 403) {
                await limiter.sleep(1000, 5000);
            }
            let body = null;
            try {
                body = await response.json();
            }
            catch {
                // если не JSON
            }
            return {
                ok: status >= 200 && status < 300,
                status,
                body,
                headers: response.headers(),
                url: options.url,
            };
        }
        catch (error) {
            return {
                ok: false,
                status: 0,
                body: null,
                error,
                headers: {},
                url: options.url,
            };
        }
    }
    async worker(targetUrl, page, limiter, getNext, sku) {
        const results = [];
        while (true) {
            if (!targetUrl)
                break;
            await limiter.wait();
            results.push(await this.execute(targetUrl, page, undefined, sku));
        }
        return results;
    }
    async execute(url, page, product, sku) {
        const errors = [];
        const data = {};
        try {
            console.log('===>>>   Пробую url = ', url);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('.container');
            try {
                await gallery.first().waitFor({ state: 'attached', timeout: 15000 });
            }
            catch (error) {
                throw new Error(`No gallery found on page: ${error}`);
            }
            const imageUrls = await gallery
                .locator('img')
                .evaluateAll(imgs => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map(img => img.src));
            console.log('======>>>   imageUrls = ', imageUrls);
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            if (!sku)
                throw new Error('SKU is required');
            data[sku] = imageUrls;
        }
        catch (err) {
            console.log('======>>>   err = ', err);
            errors.push({
                error: err,
                product: product,
                url: url,
            });
        }
        return { data, errors };
    }
}
exports.default = PageImageSourceRozetka;
