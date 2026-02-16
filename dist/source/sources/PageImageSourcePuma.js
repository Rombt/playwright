"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSourcePuma {
    executeHttpRequest(request, headers, targetUrl, product) {
        throw new Error('Method not implemented.');
    }
    workerHttpRequest(request, headers, targetUrl, limiter, getNext) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return (task.metadata.target_website === 'https://ua.puma.com/uk/catalogsearch/result/?q={{sku_prod}}');
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
            const galleries = page.locator('figure.zoom-image-gallery__figure');
            try {
                await galleries.first().waitFor({ state: 'attached', timeout: 15000 });
            }
            catch (error) {
                throw new Error(`No gallery found on page: ${error}`);
            }
            const imageUrls = await galleries.evaluateAll(figures => figures
                .map(fig => {
                const img = fig.querySelector('img');
                if (img?.currentSrc && !img.currentSrc.startsWith('data:'))
                    return img.currentSrc;
                const src = img?.getAttribute('src');
                if (src && !src.startsWith('data:'))
                    return src;
                const lazy = img?.getAttribute('data-lazy');
                if (lazy)
                    return lazy;
                return fig.getAttribute('data-large-img');
            })
                // вот type guard для TS
                .filter((url) => url !== null && url !== undefined));
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
exports.default = PageImageSourcePuma;
