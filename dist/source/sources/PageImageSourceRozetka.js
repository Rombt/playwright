"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class PageImageSourceRozetka {
    supports(task) {
        return task.type === 'recollect-product-photos';
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
    execute(targetUrl, page, product) {
        throw new Error('Method not implemented.');
    }
    async workerHttpRequest(request, headers, targetUrl, limiter, getNext) {
        const results = [];
        while (true) {
            const product = getNext();
            if (!product)
                break;
            await limiter.wait();
            results.push(await this.executeHttpRequest(request, headers, targetUrl, product));
        }
        return results;
    }
    async executeHttpRequest(request, headers, targetUrl, product) {
        const errors = [];
        const data = {};
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '') ?? '';
        try {
            const response = await request.get(targetUrl, {
                params: {
                    country: 'UA',
                    lang: 'ua',
                    text: sku,
                },
                headers: headers,
            });
            if (response.status() === 429 || response.status() === 403) {
                await this.delay(10000);
                return { data, errors };
            }
            const res = await response.json();
            console.log('for sku ', sku);
            console.log('res: ');
            console.dir(res, { depth: null, colors: true });
        }
        catch (err) {
            errors.push({
                error: err,
                product: product,
                url: targetUrl,
            });
        }
        console.log('==>> data: ', data);
        return { data, errors };
    }
    //todo использовать const limiter = new RateLimiter(2000);
    delay(ms) {
        return new Promise(res => setTimeout(res, ms));
    }
}
exports.default = PageImageSourceRozetka;
