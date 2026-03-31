"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fast_fuzzy_1 = require("fast-fuzzy");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceBezet {
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.bezet.com.ua/search?s={{sku_prod}}';
    }
    async worker(targetUrl, page, limiter, getNext, loggerScope, sku, debugMeta) {
        const results = [];
        let product;
        if (typeof getNext === 'function') {
            product = getNext();
        }
        else if (getNext) {
            product = getNext;
        }
        if (!product) {
            throw new Error('Product is undefined');
        }
        loggerScope?.debug('Worker initialized with valid product', {
            component: 'DPageImageSourceColumbia',
            method: 'worker(...)',
            data: {
                targetUrl: targetUrl,
                page: page,
                product: product,
                limiter: limiter,
                sku: sku,
                debugMeta: debugMeta,
            },
        });
        results.push(await this.execute(targetUrl, page, product));
        return results;
    }
    async execute(targetUrl, page, product) {
        const errors = [];
        const images = {};
        let html = '';
        const rawSku = product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = (starIndex !== -1 ? rawSku?.slice(0, starIndex) : rawSku)?.replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '') ?? '';
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const link = page.locator('.product > .info > a').first();
            const empty = page.locator('.col-12 .row .flex-row-reverse > p', {
                hasText: 'нічого не знайдено',
            });
            try {
                await Promise.race([
                    link.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
                    empty.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
                ]);
            }
            catch {
                throw new Error(`Search result not resolved. ${sku}`);
            }
            if ((await empty.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`);
            }
            const links = page.locator('.product > .info > a');
            await links.first().waitFor({ state: 'visible' });
            const quantityLinks = await links.count();
            let bestMatch = null;
            let bestScore = -Infinity;
            for (let i = 0; i < quantityLinks; i++) {
                const link = links.nth(i);
                const text = (await link.innerText()).trim();
                const score = (0, fast_fuzzy_1.fuzzy)(product.name_product, text);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = link;
                }
            }
            if (!bestMatch) {
                throw new Error('The product name not found');
            }
            const relativeHref = await bestMatch.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('div.previews');
            try {
                await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            }
            catch (error) {
                throw new Error('No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            const firstImg = gallery.locator('img').first();
            await firstImg.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const imageUrls = await gallery
                .locator('.images_previews')
                .evaluateAll((links) => links.map((link) => link.getAttribute('data-full')).filter(Boolean));
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            // поиск описания
            const htmlCont = page.locator('div.tab-content');
            await htmlCont
                .first()
                .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            // удаляю script
            html = await htmlCont.evaluate((el) => {
                el.querySelectorAll('script').forEach((script) => script.remove());
                return el.innerHTML;
            });
            // console.log('htmlCont.count() = ', await htmlCont.count());
            images[sku] = imageUrls;
            images[sku].idProduct = product.id_product;
        }
        catch (err) {
            throw this.buildWorkerError(err, product, url);
        }
        return {
            data: {
                images,
                html,
            },
            errors,
        };
    }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceBezet;
