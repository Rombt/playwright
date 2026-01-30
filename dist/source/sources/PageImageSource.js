"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSource {
    constructor() {
        this.i = 0; //! для тестов
        // buildProductUrl(targetUrl: string, sku: string) {
        //   sku = sku.slice(0, sku.indexOf('*'));
        //   return targetUrl.replace('{{sku_prod}}', sku);
        // }
    }
    supports(task) {
        return task.type === 'collect_product_photos';
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
        const data = [];
        try {
            // this.i++;
            // console.log('*****  execute ***** i = ', this.i);
            const rawSku = product.sku;
            const starIndex = rawSku.indexOf('*');
            const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
            const url = targetUrl.replace('{{sku_prod}}', sku);
            await page.goto(url);
            // находим первую картинку для перехода
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const image = page.locator('#app-main img').first();
            await image.waitFor({ state: 'visible', timeout: 5000 });
            await image.click();
            // await page.close();
        }
        catch (err) {
            errors.push(err);
        }
        return { data, errors };
    }
}
exports.default = PageImageSource;
