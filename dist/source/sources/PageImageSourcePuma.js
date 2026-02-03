"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSourcePuma {
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
            const imageUrls = await page
                .locator('figure.zoom-image-gallery__figure')
                .evaluateAll(figures => figures
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
