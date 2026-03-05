"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceNike {
    // private readonly logger: Logger;
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
        // this.logger = Logger.getInstance();
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return task.metadata.target_website === 'https://www.nike.com/fi/w?q={{sku_prod}}';
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
        results.push(await this.execute(targetUrl, page, { product, loggerScope }));
        return results;
    }
    async execute(targetUrl, page, options, debugMeta) {
        const errors = [];
        const data = {};
        const rawSku = options.product.sku;
        const starIndex = rawSku.indexOf('*');
        const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const link = page
                .locator('#skip-to-products > div:nth-child(1) > div > figure > a.product-card__img-link-overlay')
                .first();
            await link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            const href = await link.getAttribute('href');
            if (!href) {
                options.loggerScope?.error(`Product link not found`, {
                    component: 'PageImageSourceNike',
                    method: 'execute()',
                    action: "href = await link.getAttribute('href')",
                    data: {
                        href: href,
                    },
                });
                throw new Error('Error. Product link not found');
            }
            options.loggerScope?.debug(`Collecting image URLs is started`, {
                component: 'PageImageSourceNike',
                method: 'execute()',
                action: "href = await link.getAttribute('href')",
                data: {
                    href: href,
                },
            });
            await page.goto(href, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('#__next > main > div.nds-grid.pdp-grid.css-qqclnk.ehf3nt20 > div.grid-item.product-imagery.pt12-md.d-sm-h.d-lg-b.css-gv5k5e.e4lt99o0.nds-grid-item > div');
            try {
                await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            }
            catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                options.loggerScope?.error(`No gallery found on page`, {
                    component: 'PageImageSourceNike',
                    method: 'execute()',
                    action: 'gallery.waitFor(...)',
                    data: {
                        href: href,
                        errorName: error instanceof Error ? error.name : undefined,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
                throw new Error('Error. No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            const firstImg = gallery.locator('img').first();
            await firstImg.waitFor({ state: 'attached', timeout: 15000 });
            const imageUrls = await gallery
                .locator('img')
                .evaluateAll((imgs) => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map((img) => img.src));
            if (imageUrls.length === 0) {
                options.loggerScope?.error(`No valid image URLs found`, {
                    component: 'PageImageSourceNike',
                    method: 'execute()',
                    action: 'gallery.waitFor(...)',
                    data: {
                        href: href,
                        imageUrlsLength: imageUrls.length,
                        imageUrls: imageUrls,
                    },
                });
                throw new Error('Error. No valid image URLs found');
            }
            data[sku] = imageUrls;
        }
        catch (err) {
            throw this.buildWorkerError(err, options.product, url);
        }
        options.loggerScope?.debug(`Collecting image URLs is complete`, {
            component: 'PageImageSourceNike',
            method: 'execute()',
            action: 'data[sku] = imageUrls',
            data: {
                urls: data,
            },
        });
        return { data, errors };
    }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceNike;
