"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
const Logger_1 = require("../../data/logger/Logger");
class PageImageSourceRozetka {
    constructor() {
        this.logger = Logger_1.Logger.getInstance();
    }
    supports(task) {
        return task.type === 'recollect-product-photos';
    }
    async workerHttpRequest(request, headers, targetUrl, limiter, getNext, debugMeta) {
        const results = [];
        let indexForDebug = 0;
        while (true) {
            indexForDebug++;
            const product = getNext();
            if (!product) {
                this.logger.error(`Product is absent`, {
                    component: 'PageImageSourceRozetka',
                    method: 'workerHttpRequest',
                    action: 'whileIteration',
                    stage: 'start',
                    data: {
                        indexForDebug: indexForDebug,
                        product: product,
                    },
                });
                break;
            }
            const loggerScope = this.logger.withContext(`workerHttpRequest   ${debugMeta.brand_name}   ${product.sku}`);
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
                loggerScope: loggerScope,
            };
            loggerScope.debug(`Success.`, {
                component: 'PageImageSourceRozetka',
                method: 'workerHttpRequest',
                action: 'whileIteration',
                stage: 'start',
                data: {
                    indexForDebug: indexForDebug,
                    rawSku: rawSku,
                    sku: sku,
                    options: options,
                },
            });
            await limiter.wait();
            const requestResult = await this.executeHttpRequest(request, options);
            results.push(requestResult);
        }
        return results;
    }
    async executeHttpRequest(request, options) {
        const limiter = new RateLimiter_1.RateLimiter(5000);
        try {
            const response = await request.get(options.url, {
                params: options.params,
                headers: options.headers,
            });
            const status = response.status();
            const blockingStatuses = [401, 403, 405, 407, 429, 451, 503];
            if (blockingStatuses.includes(status)) {
                options.loggerScope?.error(`[Blocking Detected]`, {
                    component: 'PageImageSourceRozetka',
                    method: 'executeHttpRequest',
                    responseUrl: response.url(),
                });
                switch (status) {
                    case 429: // Rate Limit
                        options.loggerScope?.error(`Лимит запросов. Увеличиваем паузу...`, {
                            component: 'PageImageSourceRozetka',
                            method: 'executeHttpRequest',
                            status: status,
                        });
                        await limiter.sleep(5000, 10000);
                        break;
                    case 403: // Forbidden / Anti-bot
                    case 451: // Geo-Block
                        options.loggerScope?.error(`Обнаружена блокировка доступа. Требуется смена прокси/сессии.`, {
                            component: 'PageImageSourceRozetka',
                            method: 'executeHttpRequest',
                            status: status,
                        });
                        //todo логика смены прокси: await proxyManager.rotate();
                        await limiter.sleep(2000, 5000);
                        break;
                    case 401: // Unauthorized
                        options.loggerScope?.error(`Сессия истекла. Перезапуск авторизации...`, {
                            component: 'PageImageSourceRozetka',
                            method: 'executeHttpRequest',
                            status: status,
                        });
                        //todo Вызов функции логина
                        break;
                    case 503: // WAF Challenge (Cloudflare и др.)
                        options.loggerScope?.error(`Сервер временно недоступен или проверяет браузер.`, {
                            component: 'PageImageSourceRozetka',
                            method: 'executeHttpRequest',
                            status: status,
                        });
                        await limiter.sleep(10000, 15000);
                        break;
                    default:
                        options.loggerScope?.error(`Нестандартный статус блокировки`, {
                            component: 'PageImageSourceRozetka',
                            method: 'executeHttpRequest',
                            status: status,
                        });
                        await limiter.sleep(1000, 3000);
                }
            }
            let body = null;
            try {
                body = await response.json();
                options.loggerScope?.debug(`The "response.json()" succeeded`, {
                    component: 'PageImageSourceRozetka',
                    method: 'workerHttpRequest',
                    body: body,
                });
            }
            catch (error) {
                // Если не JSON, пробуем получить текст для диагностики блокировки
                const rawText = await response.text().catch(() => 'Не удалось прочитать body');
                const contentType = response.headers()['content-type'] || 'unknown';
                options.loggerScope?.error(`[Payload Error] Ожидался JSON, получен некорректный формат`, {
                    component: 'PageImageSourceRozetka',
                    method: 'executeHttpRequest',
                    status: status,
                    ContentType: contentType,
                    RawBody_200_symbol: rawText.substring(0, 200).trim(),
                });
                // Логика принятия решения на основе текста
                if (rawText.includes('cloudflare') || rawText.includes('captcha')) {
                    options.loggerScope?.error(`!!! Обнаружен экран проверки (WAF/Challenge) !!!`, {
                        component: 'PageImageSourceRozetka',
                        method: 'executeHttpRequest',
                    });
                }
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
            options.loggerScope?.error(`The "response.json()" is failed`, {
                component: 'PageImageSourceRozetka',
                method: 'executeHttpRequest',
                error: error,
            });
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
    async worker(targetUrl, page, limiter, getNext, sku) {
        const results = [];
        // while (true) {
        // if (!targetUrl) break;
        await limiter.wait();
        results.push(await this.execute(targetUrl, page, undefined, sku));
        // }
        return results;
    }
    async execute(url, page, product, sku) {
        const errors = [];
        const data = {};
        try {
            console.log('===>>>   Пробую url = ', url);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const gallery = page.locator('.container');
            try {
                await gallery.first().waitFor({ state: 'attached', timeout: 15000 });
            }
            catch (error) {
                throw new Error(`No gallery found on page: ${error}`);
            }
            const imageUrls = await gallery
                .locator('img')
                .evaluateAll((imgs) => imgs
                .filter((img) => img instanceof HTMLImageElement)
                .map((img) => img.src));
            console.log('======>>>   imageUrls = ', imageUrls);
            if (imageUrls.length === 0)
                throw new Error('No valid image URLs found');
            if (!sku)
                throw new Error('SKU is required');
            data[sku] = imageUrls;
        }
        catch (err) {
            console.log('======>>>   err = ', err);
            errors.push({
                error: err,
                product: product,
                url: url,
            });
        }
        return { data, errors };
    }
}
exports.default = PageImageSourceRozetka;
