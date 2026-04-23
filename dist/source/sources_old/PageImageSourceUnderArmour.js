"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const Logger_1 = require("../../data/logger/Logger");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceUnderArmour {
    config;
    logger;
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
        this.logger = Logger_1.Logger.getInstance();
    }
    workerHttpRequest(request, headers, targetUrl, limiter, sku) {
        throw new Error('Method not implemented.');
    }
    executeHttpRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    supports(task) {
        return (task.metadata.target_website === 'https://www.underarmour.com/en-us/search/?q={{sku_prod}}');
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
        const limiter = new RateLimiter_1.RateLimiter(this.config.asyncRetry.maxDelay);
        // нормализация SKU
        const rawSku = product.sku;
        const sku = rawSku.includes('*') ? rawSku.split('*')[0] : rawSku;
        const [id, variant] = sku.split('-');
        const url = targetUrl.replace('{{sku_prod}}', id);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            //!!
            const link = page
                .locator(`div[data-testid="product-tile-container"] a.ProductTile-module-scss-module__YG6sUW__product-image-link[href*="${id}"]`)
                .first();
            const countLink = await link.count();
            this.logger?.debug(`The link is found on the page`, {
                component: 'PageImageSourceUnderArmour',
                method: 'execute()',
                action: 'link = page.locator(...)',
                data: {
                    url: url,
                    rawSku: rawSku,
                    sku: sku,
                    id: id,
                    variant: variant,
                    linkCount: countLink,
                },
            });
            const empty = page.locator('div[data-testid="empty-search-result"] > span', {
                hasText: 'Sorry, no results for',
            });
            try {
                await Promise.race([
                    link.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
                    empty.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay }),
                ]);
            }
            catch (err) {
                this.logger?.debug(`**Search result not resolved. ${sku}`, {
                    component: 'PageImageSourceUnderArmour',
                    method: 'execute()',
                    action: 'await Promise.race([...])',
                    data: {
                        url: url,
                        err: err,
                    },
                });
                throw new Error(`Search result not resolved. ${sku}`);
            }
            if ((await empty.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`);
            }
            const relativeHref = await link.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            //!!
            // проверка соответствия страницы запрашиваемому sku
            const input_page_sku = page.locator(`input[name="colors"][value="${variant}"]`);
            await input_page_sku.waitFor();
            const id_input_page_sku = await input_page_sku.getAttribute('id');
            const label_page_sku = page.locator(`label[for="${id_input_page_sku}"]`);
            await label_page_sku.click();
            //!!
            const image = page
                .locator(`div.ProductImages-module-scss-module__NG3QBq__pdpImages div.swiper-wrapper div.swiper-slide img[src*="${id}-${variant}"]`)
                .first();
            await image.waitFor({
                state: 'visible',
                timeout: this.config.asyncRetry.maxDelay,
            });
            //!!
            // галерея
            const gallery = page.locator('div.ProductImages-module-scss-module__NG3QBq__pdpImages div.swiper-wrapper');
            await gallery.waitFor({
                state: 'attached',
                timeout: this.config.asyncRetry.maxDelay,
            });
            // прогружаем все слайды (Swiper lazy)
            const slides = await page.locator('div.swiper-slide').all();
            for (const slide of slides) {
                await slide.scrollIntoViewIfNeeded();
            }
            // локатор картинок
            const imageElements = gallery.locator('img');
            await imageElements.first().waitFor({
                state: 'attached',
                timeout: this.config.asyncRetry.maxDelay,
            });
            // извлечение URL
            const imageUrls = await imageElements.evaluateAll((imgs) => {
                const normalizeScene7 = (url) => {
                    try {
                        const u = new URL(url);
                        // только качество, без апскейла
                        u.searchParams.set('qlt', '90');
                        u.searchParams.set('fmt', 'jpg');
                        return u.toString();
                    }
                    catch {
                        return url;
                    }
                };
                const extractFromSrcset = (srcset) => {
                    const candidates = srcset
                        .split(',')
                        .map((item) => {
                        const [url, size] = item.trim().split(' ');
                        const width = size ? parseInt(size.replace('w', ''), 10) : 0;
                        return { url, width };
                    })
                        .filter((c) => c.url);
                    if (!candidates.length)
                        return null;
                    // берём максимально возможный реальный размер
                    candidates.sort((a, b) => b.width - a.width);
                    return candidates[0].url;
                };
                const extractBestUrl = (img) => {
                    // 1. data-srcset (часто у lazy)
                    const dataSrcset = img.getAttribute('data-srcset');
                    if (dataSrcset) {
                        const url = extractFromSrcset(dataSrcset);
                        if (url)
                            return url;
                    }
                    // 2. srcset (основной источник)
                    const srcset = img.getAttribute('srcset');
                    if (srcset) {
                        const url = extractFromSrcset(srcset);
                        if (url)
                            return url;
                    }
                    // 3. data-src
                    const dataSrc = img.getAttribute('data-src');
                    if (dataSrc)
                        return dataSrc;
                    // 4. fallback src
                    const src = img.getAttribute('src');
                    if (src && !src.includes('.svg'))
                        return src;
                    return null;
                };
                const urls = imgs
                    .map((img) => {
                    const rawUrl = extractBestUrl(img);
                    return rawUrl ? normalizeScene7(rawUrl) : null;
                })
                    .filter((url) => Boolean(url));
                // удаляем дубликаты
                return Array.from(new Set(urls));
            });
            // проверка
            if (imageUrls.length === 0) {
                throw new Error('No valid image URLs found');
            }
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
exports.default = PageImageSourceUnderArmour;
