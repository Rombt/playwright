"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSource {
    constructor() {
        this.i = 0; //! для тестов
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
            this.i++;
            console.log('*****  execute ***** i = ', this.i);
            console.log('targetUrl = ', targetUrl);
            console.log('product = ', product);
            //* Здесь все операции со страницей
            // const url = buildProductUrl(product.sku);
            // await page.goto(url, { waitUntil: 'domcontentloaded' });
        }
        catch (err) {
            errors.push(err);
        }
        return { data, errors };
    }
}
exports.default = PageImageSource;
