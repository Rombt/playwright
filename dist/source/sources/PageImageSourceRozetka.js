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
    execute(targetUrl, page, product) {
        throw new Error('Method not implemented.');
    }
    async executeHttpRequest(request, options) {
        try {
            const response = await request.get(options.url, {
                params: options.params,
                headers: options.headers,
            });
            const status = response.status();
            if (status === 429 || status === 403) {
                await this.delay(10000);
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
    //todo использовать const limiter = new RateLimiter(2000);
    delay(ms) {
        return new Promise(res => setTimeout(res, ms));
    }
}
exports.default = PageImageSourceRozetka;
