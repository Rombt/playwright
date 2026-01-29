"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSource {
    supports(task) {
        return task.type === 'collect_product_photos';
    }
    execute(task, context) {
        throw new Error("Method not implemented.");
    }
    async worker(page, limiter, getNext) {
        while (true) {
            const product = getNext();
            if (!product)
                break;
            await limiter.wait();
            console.log("*****  worker *****");
            // const url = buildProductUrl(product.sku);
            // await page.goto(url, { waitUntil: 'domcontentloaded' });
            // await runScenario(page, product);
            // Небольшая "человеческая" пауза
            // await delay(300 + Math.random() * 400);
        }
    }
}
exports.default = PageImageSource;
