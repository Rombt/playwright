"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Logger_1 = require("../../../data/logger/Logger");
const appConfig_1 = require("../../../data/config/appConfig");
const helpers_1 = require("../../../common/helpers");
class PageImageSourceSvastone {
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
        return task.metadata.target_website === 'https://svastone.com/search/?search={{sku_prod}}';
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
            const noProduct = page.locator('#products-list ', {
                hasText: 'нічого не знайдено',
            });
            if ((await noProduct.count()) > 0) {
                throw new Error(`Goods not found on the page. ${sku}`);
            }
            //!!
            // страницы результатов поиска у этого источника нет
            const page_sku = page.locator('h1', {
                hasText: `${sku}`,
            });
            await page_sku
                .first()
                .waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            if ((await page_sku.count()) === 0) {
                throw new Error(`The page is not match sku  ${sku}`);
            }
            //!!
            const image = page.locator('div.product-gallery div.slick-track li img').first();
            await image.waitFor({
                state: 'attached',
                timeout: this.config.asyncRetry.maxDelay,
            });
            //!!
            const gallery = page.locator('div.product-gallery div.slick-track');
            try {
                await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
            }
            catch (error) {
                throw new Error('No gallery found on page');
            }
            const count = await gallery.count();
            if (count === 0)
                throw new Error('No images found on page');
            //!!
            const urlImages = await (0, helpers_1.extractSlickImages)(page, {
                container: gallery,
            });
            images[sku] = Array.from(new Set(urlImages));
            images[sku].idProduct = product.id_product;
            html = await (0, helpers_1.extractRawHtml)(page, {
                containers: ['.product-quick-description-banner', '.tabs product-tabs'],
                removeSelectors: [
                    '.product-best-for',
                    '.product_tabs_reviews',
                    '.product_tabs_full_describe',
                ],
            });
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
    // попытка обойти капчу не удачная....
    // async execute(targetUrl: string, page: Page, product: IProduct): Promise<IWorkerResult> {
    //   const errors: IWorkerError[] = [];
    //   const images: IDataImag = {};
    //   let html: string = '';
    //   const rawSku = product.sku;
    //   const starIndex = rawSku.indexOf('*');
    //   const sku = starIndex !== -1 ? rawSku.slice(0, starIndex) : rawSku;
    //   const url = targetUrl.replace('{{sku_prod}}', sku);
    //   try {
    //     await page.goto(url, { waitUntil: 'domcontentloaded' });
    //     await this.handleCaptchaIfPresent(page);
    //     const link = page
    //       .locator('div[data-testid="container"] a:has(section[aria-label*="Main product image"])')
    //       .first();
    //     const empty = page.locator('h2', {
    //       hasText: 'Sorry, we hebben geen resultaten gevonden',
    //     });
    //     try {
    //       await Promise.race([
    //         link.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
    //         empty.waitFor({ state: 'visible', timeout: this.config.asyncRetry.maxDelay }),
    //       ]);
    //     } catch {
    //       await this.handleCaptchaIfPresent(page);
    //       throw new Error(`Search result not resolved. ${sku}`);
    //     }
    //     await this.handleCaptchaIfPresent(page);
    //     if ((await empty.count()) > 0) {
    //       throw new Error(`Goods not found on the page. ${sku}`);
    //     }
    //     const relativeHref = await link.getAttribute('href');
    //     if (!relativeHref) throw new Error('Product link not found');
    //     const absoluteHref = new URL(relativeHref, page.url()).toString();
    //     await page.goto(absoluteHref, { waitUntil: 'domcontentloaded' });
    //     await this.handleCaptchaIfPresent(page);
    //     await page.waitForURL(
    //       (url) => {
    //         const u = new URL(url.toString());
    //         return u.pathname.includes(sku);
    //       },
    //       {
    //         timeout: this.config.asyncRetry.maxDelay,
    //       },
    //     );
    //     await this.handleCaptchaIfPresent(page);
    //     const image = page.locator('section.s-area-gallery button.s-w-full.s-h-full > img').first();
    //     await image.waitFor({
    //       state: 'attached',
    //       timeout: this.config.asyncRetry.maxDelay,
    //     });
    //     await this.handleCaptchaIfPresent(page);
    //     const gallery = page.locator('section.s-area-gallery');
    //     try {
    //       await gallery.waitFor({ state: 'attached', timeout: this.config.asyncRetry.maxDelay });
    //     } catch (error) {
    //       await this.handleCaptchaIfPresent(page);
    //       throw new Error('No gallery found on page');
    //     }
    //     const count = await gallery.count();
    //     if (count === 0) throw new Error('No images found on page');
    //     await this.handleCaptchaIfPresent(page);
    //     const absoluteImageUrls = await page
    //       .locator('section.s-area-gallery img')
    //       .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src') || ''));
    //     images[sku] = absoluteImageUrls as IDataImagItem;
    //     images[sku].idProduct = product.id_product;
    //   } catch (err) {
    //     throw this.buildWorkerError(err, product, url);
    //   }
    //   return {
    //     data: {
    //       images,
    //       html,
    //     },
    //     errors,
    //   };
    // }
    // private async handleCaptchaIfPresent(page: Page) {
    //   const container = page.locator('.px-captcha-container');
    //   if (await container.isVisible().catch(() => false)) {
    //     await this.solveHoldCaptcha(page);
    //     // ждём исчезновения капчи
    //     await container
    //       .waitFor({
    //         state: 'hidden',
    //         timeout: 10000,
    //       })
    //       .catch(() => {});
    //   }
    // }
    // private async solveHoldCaptcha(
    //   page: Page,
    //   options?: {
    //     iframeSelector?: string;
    //     holdTime?: number;
    //   },
    // ) {
    //   const iframeSelector = options?.iframeSelector || '#px-captcha iframe';
    //   const holdTime = options?.holdTime || 3000;
    //   // 1. Ждём iframe
    //   const iframeElement = page.locator(iframeSelector);
    //   await iframeElement.waitFor({
    //     state: 'visible',
    //     timeout: 15000,
    //   });
    //   // 2. Получаем bounding box iframe
    //   const box = await iframeElement.boundingBox();
    //   if (!box) {
    //     throw new Error('Captcha iframe not found or has no size');
    //   }
    //   const x = box.x + box.width / 2;
    //   const y = box.y + box.height / 2;
    //   // 3. "Человеческое" движение к элементу
    //   await page.mouse.move(x - 30, y - 30);
    //   await page.waitForTimeout(100 + Math.random() * 200);
    //   await page.mouse.move(x, y, { steps: 15 });
    //   await page.waitForTimeout(100 + Math.random() * 200);
    //   // 4. Hover (дополнительно)
    //   await page.mouse.move(x + 1, y + 1);
    //   // 5. Нажатие и удержание
    //   await page.mouse.down();
    //   // микродвижение во время удержания (важно!)
    //   await page.waitForTimeout(holdTime / 2);
    //   await page.mouse.move(x + 2, y + 1);
    //   await page.waitForTimeout(holdTime / 2);
    //   await page.mouse.up();
    //   // 6. Небольшая пауза после
    //   await page.waitForTimeout(1000);
    // }
    buildWorkerError(err, product, targetUrl, retryable = true) {
        return {
            error: err,
            product,
            targetUrl,
        };
    }
}
exports.default = PageImageSourceSvastone;
