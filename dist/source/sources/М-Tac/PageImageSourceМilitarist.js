"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appConfig_1 = require("../../../data/config/appConfig");
class PageImageSourceMilitarist {
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
        return task.metadata.target_website === 'https://militarist.ua/ua/search/?q={{sku_prod}}';
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
        const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
        const url = targetUrl.replace('{{sku_prod}}', sku);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            //товаров не найдено
            const goodsNoFound = page.locator('.page-content', {
                hasText: 'За вашим запитом нічого не знайдено',
            });
            if ((await goodsNoFound.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`); //todo запретить retry на эту ошибку
            }
            const image = page.locator('div.card_product-head > a').first(); //todo может быть много на странице получить и обработать все
            await image.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            await image.click();
            const gallery = page.locator('div.catalog-item-gallery > div > div.big-img.slider-for.slick-initialized.slick-slider > div > div');
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
                .locator('link')
                .evaluateAll((links) => links
                .filter((link) => link instanceof HTMLLinkElement)
                .map((link) => link.href));
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            // поиск описания
            // #short_desc_block
            const htmlCont = page.locator('#short_desc_block').filter({
                hasText: 'Короткі характеристики',
            });
            await htmlCont
                .first()
                .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            console.log('htmlCont.count() = ', await htmlCont.count());
            html = await htmlCont.innerHTML({ timeout: this.config.asyncRetry.maxDelay });
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
exports.default = PageImageSourceMilitarist;
