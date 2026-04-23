"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("../../data/logger/Logger");
const appConfig_1 = require("../../data/config/appConfig");
class PageImageSourceCamotec {
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
        return task.metadata.target_website === 'https://camotec.ua/search/?searchString={{sku_prod}}';
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
            // todo разная вёрстка?!
            // #\37 143 > div > div.imageBlock > div.sliderItemBlock > div:nth-child(1) > div > a
            const link = page.locator('.slick-track > .slick-slide > .img_wrap > a').first();
            const empty = page.locator('.text-center.emptyList', {
                hasText: 'За вашим запитом',
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
            await link.waitFor({ state: 'visible' });
            const relativeHref = await link.getAttribute('href');
            if (!relativeHref)
                throw new Error('Product link not found');
            const absoluteHref = new URL(relativeHref, page.url()).toString();
            await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
            const page_sku = page.locator('div.infoCol > div.infoBlock div.infoAndReviewBlock p.vendorCode', {
                hasText: `${sku}`,
            });
            await page_sku
                .first()
                .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            if ((await page_sku.count()) === 0) {
                throw new Error(`The page is not match sku  ${sku}`);
            }
            const gallery = page.locator('div.slider-for.slick-initialized.slick-slider');
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
            // .slick-slide > .img_wrap > a.mainImage
            const imageUrls = await gallery
                .locator('.slick-slide > .img_wrap > a.mainImage')
                .evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean));
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            try {
                // поиск описания
                const htmlCont = page.locator('#offerDescriptionText > div');
                await htmlCont
                    .first()
                    .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
                html = await htmlCont.innerHTML({ timeout: this.config.asyncRetry.maxDelay });
            }
            catch (error) {
                this.logger?.debug(`Description is absent`, {
                    component: 'PageImageSourceBRS',
                    method: 'execute()',
                    action: 'const htmlCont = page.locator(\'div.product__section > [itemprop="description"]\'',
                    data: {
                        sku: sku,
                        url: url,
                    },
                });
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
exports.default = PageImageSourceCamotec;
