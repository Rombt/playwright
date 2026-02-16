"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSourceNike {
    executeHttpRequest(request, headers, targetUrl, product) {
        throw new Error('Method not implemented.');
    }
    workerHttpRequest(request, headers, targetUrl, limiter, getNext) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.nike.com/fi/w?q={{sku_prod}}';
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
                .locator('#skip-to-products > div:nth-child(1) > div > figure > a.product-card__img-link-overlay')
                .first();
            await link.waitFor({ state: 'attached', timeout: 30000 });
            const href = await link.getAttribute('href');
            if (!href)
                throw new Error('Product link not found');
            console.log('===>>  href = ', href);
            await page.goto(href, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('#__next > main > div.nds-grid.pdp-grid.css-qqclnk.ehf3nt20 > div.grid-item.product-imagery.pt12-md.d-sm-h.d-lg-b.css-gv5k5e.e4lt99o0.nds-grid-item > div');
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
                .evaluateAll(imgs => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map(img => img.src));
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
exports.default = PageImageSourceNike;
