"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSourceColumbia {
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return (task.metadata.target_website ===
            'https://www.columbia.com/search?q={{sku_prod}}&searchMethod=manualSearch');
    }
    async worker(targetUrl, page, limiter, getNext) {
        const results = [];
        while (true) {
            const product = getNext();
            if (!product)
                break;
            await limiter.wait();
            results.push(await this.execute(targetUrl, page, product));
        }
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
            const image = page.locator('#app-main img').first();
            await image.waitFor({ state: 'attached', timeout: 5000 });
            await image.click();
            const gallery = page.locator('[data-component-id="image-gallery"]');
            try {
                await gallery.waitFor({ state: 'attached', timeout: 15000 });
            }
            catch (error) {
                throw new Error('No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            const firstImg = gallery.locator('img').first();
            await firstImg.waitFor({ state: 'attached', timeout: 15000 });
            const imageUrls = await gallery
                .locator('img')
                .evaluateAll((imgs) => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map((img) => img.src));
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            data[sku] = imageUrls;
        }
        catch (err) {
            errors.push({
                error: err,
                product: product,
                url: url,
            });
        }
        return { data, errors };
    }
}
exports.default = PageImageSourceColumbia;
