"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRSSource = void 0;
const BasePageSource_1 = require("../BasePageSource");
const DirectPageResolver_1 = require("../strategies/resolvers/DirectPageResolver");
const SimpleDescriptionExtractor_1 = require("../strategies/extractors/SimpleDescriptionExtractor");
class BRSSource extends BasePageSource_1.BasePageSource {
    resolver = new DirectPageResolver_1.DirectPageResolver();
    imageExtractor = undefined; // пока без ImageExtractor
    descriptionExtractor = new SimpleDescriptionExtractor_1.SimpleDescriptionExtractor('div.product__section > [itemprop="description"]');
    supports(task) {
        return task.metadata.target_website === 'https://borsuk.com.ua/katalog/search/?q={{sku_prod}}';
    }
    async worker(targetUrl, page, limiter, getNext, loggerScope, sku, debugMeta) {
        const product = typeof getNext === 'function' ? getNext() : getNext;
        if (!product) {
            throw new Error('Product is undefined');
        }
        const result = await this.execute(targetUrl, page, {}, debugMeta, product.sku);
        return [result];
    }
    async execute(targetUrl, page, options, debugMeta, sku) {
        const errors = [];
        try {
            if (!sku) {
                throw new Error('SKU is required');
            }
            const normalizedSku = this.normalizeSku(sku);
            const url = targetUrl.replace('{{sku_prod}}', normalizedSku);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const link = page.locator('div.catalogCard-view > a').first();
            const empty = page.locator('.catalog__content > div > p', { hasText: 'Немає товарів' });
            await Promise.race([
                link.waitFor({ state: 'visible', timeout: 15000 }),
                empty.waitFor({ state: 'visible', timeout: 15000 }),
            ]);
            if ((await empty.count()) > 0) {
                throw new Error(`Goods not found: ${sku}`);
            }
            const href = await link.getAttribute('href');
            if (!href)
                throw new Error('Product link not found');
            const absolute = new URL(href, page.url()).toString();
            await page.goto(absolute, { waitUntil: 'domcontentloaded' });
            // check sku
            const skuLocator = page.locator('div.product-header div.product-header__code', {
                hasText: sku,
            });
            await skuLocator.first().waitFor({
                state: 'attached',
                timeout: 15000,
            });
            // extraction via strategies
            const extraction = await this.extract(page);
            return this.buildResult(extraction, errors, normalizedSku);
        }
        catch (err) {
            throw this.buildError(err, targetUrl, sku);
        }
    }
    normalizeSku(rawSku) {
        const starIndex = rawSku.indexOf('*');
        return (starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku)
            .replace(/^[\p{C}\s]+|[\p{C}\s]+$/gu, '')
            .trim();
    }
    buildError(err, targetUrl, sku) {
        return {
            error: err,
            targetUrl,
            sku,
        };
    }
    // HTTP (legacy untouched)
    executeHttpRequest(request, options) {
        throw new Error('Not implemented');
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Not implemented');
    }
}
exports.BRSSource = BRSSource;
