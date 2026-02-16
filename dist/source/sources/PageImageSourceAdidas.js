"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSourceAdidas {
    workerHttpRequest(request, headers, targetUrl, limiter, getNext) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.adidas.ua/search?s={{sku_prod}}';
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
            const link = page
                .locator('div.list.store__list > div > div > div.product__image > a')
                .first();
            await link.waitFor({ state: 'attached', timeout: 30000 });
            const relativeHref = await link.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            console.log('===>>  absoluteHref = ', absoluteHref);
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('#gallery > div > div.slider__carousel.slick-slider.slick-initialized > div > div');
            try {
                await gallery.waitFor({ state: 'attached', timeout: 15000 });
            }
            catch (error) {
                throw new Error('No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            const images = gallery.locator('img');
            await images.first().waitFor({ state: 'attached', timeout: 15000 });
            const imageUrls = await images.evaluateAll(imgs => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map(img => img.getAttribute('data-src') || img.getAttribute('data-srcset'))
                .filter((src) => Boolean(src)));
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
        console.log('==>> data: ', data);
        return { data, errors };
    }
}
exports.default = PageImageSourceAdidas;
