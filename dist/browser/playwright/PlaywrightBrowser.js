"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
const path = require("path");
const crypto = require("crypto");
const fs = require("fs/promises");
const playwright_1 = require("playwright");
const FingerprintPool_1 = require("../fingerprint/FingerprintPool");
const appConfig_1 = require("../../data/config/appConfig");
const RateLimiter_1 = require("../../browser/limiter/RateLimiter");
class PlaywrightBrowser {
    constructor(launchOptions, browserContextOptions) {
        this.launchOptions = launchOptions;
        this.browserContextOptions = browserContextOptions;
        this.instance = null;
        this.config = appConfig_1.AppConfig.getInstance();
        this.limiter = new RateLimiter_1.RateLimiter(5000);
    }
    get isInitialized() {
        return this.instance !== null;
    }
    async init() {
        if (this.isInitialized)
            return this.instance;
        this.instance = await playwright_1.chromium.launch(this.launchOptions);
        return this.instance;
    }
    async close(profilesDir) {
        if (!this.instance)
            return;
        try {
            for (const context of this.instance.contexts()) {
                try {
                    await context.close();
                }
                catch (err) {
                    console.warn('Error closing context:', err);
                }
            }
        }
        catch (err) {
            console.warn('Error closing browser:', err);
        }
        finally {
            await this.instance.close();
            this.instance = null;
            if (profilesDir) {
                await fs.rm(profilesDir, {
                    recursive: true,
                    force: true,
                });
            }
        }
        console.log('Browser closed.');
    }
    async createContext(mode = 'real') {
        const browser = await this.init();
        if (mode === 'fake') {
            const fingerprintPool = new FingerprintPool_1.FingerprintPool();
            const fingerprint = fingerprintPool.get();
            if (!fingerprint) {
                throw new Error('Нет доступного fingerprint профиля');
            }
            return browser.newContext({
                ...this.browserContextOptions,
                ...fingerprint,
            });
        }
        return browser.newContext(this.browserContextOptions);
    }
    async runInContext(fn, mode) {
        const context = await this.createContext(mode);
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });
        try {
            return await fn(context);
        }
        finally {
            await context.close();
        }
    }
    async runInContextByChromium(fn, mode, loggerScope) {
        loggerScope?.debug('The enter to the runInContextByChromium', {
            component: 'PlaywrightBrowser',
            method: 'runInContextByChromium',
            stage: 'init',
            data: {},
        });
        const baseDir = path.resolve('./browser-profiles/chrome-profiles');
        await fs.mkdir(baseDir, { recursive: true });
        const profileDir = path.join(baseDir, `chrome-profile-${crypto.randomUUID()}`);
        const context = await playwright_1.chromium.launchPersistentContext(profileDir, {
            headless: false,
            channel: 'chrome',
            args: ['--disable-blink-features=AutomationControlled'],
        });
        loggerScope?.debug('Context is received', {
            component: 'PlaywrightBrowser',
            method: 'runInContextByChromium',
            stage: 'init',
            data: {
                context: context,
            },
        });
        try {
            return await fn(context);
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            loggerScope?.error('Problems with browser context', {
                component: 'PlaywrightBrowser',
                method: 'runInContextByChromium',
                action: 'return await fn(context);',
                data: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            });
            throw error;
        }
        finally {
            await context.close();
            await fs.rm(profileDir, {
                recursive: true,
                force: true,
            });
        }
    }
    async download(page, url, loggerScope) {
        let downloadEvent;
        let response;
        let buffer = Buffer.from([]);
        let ext = '';
        if (!page) {
            loggerScope?.error(`Page is undefined; browser context has been closed`, {
                component: 'PlaywrightBrowser',
                method: 'download(...)',
                action: 'page.waitForEvent(...)',
                data: {
                    url: url,
                },
            });
            throw new Error('Page is undefined; browser context has been closed');
        }
        loggerScope?.debug(`Entering PlaywrightBrowser.download()`, {
            component: 'PlaywrightBrowser',
            method: 'download()',
            action: 'start',
            data: {
                url: url,
                page: page,
            },
        });
        try {
            const result = await Promise.allSettled([
                page.waitForEvent('download', { timeout: this.config.asyncRetry.maxDelay }),
                page.goto(url),
            ]);
            if (result[0].status === 'fulfilled') {
                downloadEvent = result[0].value;
            }
            if (result[1].status === 'fulfilled') {
                response = result[1].value;
            }
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            loggerScope?.error(`Image file download failed`, {
                component: 'PlaywrightBrowser',
                method: 'download(...)',
                action: "page.waitForEvent('download', { timeout: this.config.asyncRetry.maxDelay })",
                data: {
                    url: url,
                    errorName: error instanceof Error ? error.name : undefined,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw new Error('Image file download failed');
        }
        if (downloadEvent) {
            loggerScope?.debug(`File download succeeded`, {
                component: 'PlaywrightBrowser',
                method: 'download()',
                action: 'if (downloadEvent)',
                data: {
                    downloadEvent: downloadEvent,
                },
            });
            const suggestedFilename = downloadEvent.suggestedFilename();
            const ext = path.extname(suggestedFilename) || '.jpg';
            const stream = await downloadEvent.createReadStream();
            if (!stream) {
                loggerScope?.error(`Failed to create read stream for downloaded file`, {
                    component: 'PlaywrightBrowser',
                    method: 'download(...)',
                    action: 'page.waitForEvent(...)',
                    data: {
                        stream: stream,
                    },
                });
                throw new Error('Failed to create read stream for downloaded file');
            }
            loggerScope?.debug(`File read stream created successfully.`, {
                component: 'PlaywrightBrowser',
                method: 'download(...)',
                action: 'page.waitForEvent(...)',
                data: {
                    stream: stream,
                },
            });
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            return {
                buffer: Buffer.concat(chunks),
                ext: ext,
            };
        }
        if (!response) {
            loggerScope?.error(`Failed to navigate to URL`, {
                component: 'PlaywrightBrowser',
                method: 'download(...)',
                action: 'page.goto(url)',
                data: {
                    url: url,
                },
            });
            throw new Error('Failed to navigate to URL');
        }
        try {
            buffer = await response.body();
            const contentType = response.headers()['content-type'] || '';
            if (!buffer || !contentType) {
                //todo Обработка ситуации: пропустить, повторить, или выбросить ошибку
                loggerScope?.error(`Response body or content-type is empty for URL`, {
                    component: 'PlaywrightBrowser',
                    method: 'download(...)',
                    action: 'buffer = await response.body()',
                    data: {
                        url: url,
                        buffer: buffer,
                        contentType: contentType,
                    },
                });
                throw new Error('Response body or content-type is empty for URL');
            }
            else {
                if (contentType.includes('image/jpeg'))
                    ext = '.jpg';
                else if (contentType.includes('image/png'))
                    ext = '.png';
                else if (contentType.includes('image/webp'))
                    ext = '.webp';
                else if (contentType.includes('image/avif'))
                    ext = '.avif';
                else if (contentType.includes('application/pdf'))
                    ext = '.pdf';
                loggerScope?.debug(`Response body read successfully for URL`, {
                    component: 'PlaywrightBrowser',
                    method: 'download(...)',
                    action: 'buffer = await response.body()',
                    data: {
                        url: url,
                        ext: ext,
                    },
                });
            }
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            loggerScope?.error(`Failed to read response body or headers from URL`, {
                component: 'PlaywrightBrowser',
                method: 'download(...)',
                action: 'buffer = await response.body()',
                data: {
                    url: url,
                    ext: ext,
                    errorName: error instanceof Error ? error.name : undefined,
                    errorMessage: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            });
            throw new Error('Failed to read response body or headers from URL');
        }
        return { buffer, ext };
    }
    async downloadStaticResource(url, context, loggerScope) {
        loggerScope?.debug(`Entering PlaywrightBrowser.downloadStaticResource()`, {
            component: 'PlaywrightBrowser',
            method: 'downloadStaticResource()',
            action: 'start',
            data: { url },
        });
        let response;
        try {
            response = await context.request.get(url, {
                timeout: this.config.asyncRetry.maxDelay,
            });
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            loggerScope?.error(`HTTP request failed`, {
                component: 'PlaywrightBrowser',
                method: 'downloadStaticResource()',
                action: 'request.get',
                data: {
                    url,
                    errorName: error.name,
                    errorMessage: error.message,
                    stack: error.stack,
                },
            });
            throw error;
        }
        if (!response || !response.ok()) {
            loggerScope?.error(`HTTP response not OK`, {
                component: 'PlaywrightBrowser',
                method: 'downloadStaticResource()',
                action: 'response validation',
                data: {
                    url,
                    status: response?.status(),
                },
            });
            throw new Error(`HTTP ${response?.status()} while fetching resource`);
        }
        loggerScope?.debug(`HTTP GET request completed`, {
            component: 'PlaywrightBrowser',
            method: 'downloadStaticResource()',
            action: 'await context.request.get(...)',
            data: { url: url, status: response.status(), response: response },
        });
        let buffer;
        let ext = '';
        try {
            buffer = await response.body();
            const contentType = response.headers()['content-type'] ?? '';
            if (!buffer || !contentType) {
                throw new Error('Empty body or missing content-type');
            }
            if (contentType.includes('image/jpeg'))
                ext = '.jpg';
            else if (contentType.includes('image/png'))
                ext = '.png';
            else if (contentType.includes('image/webp'))
                ext = '.webp';
            else if (contentType.includes('image/avif'))
                ext = '.avif';
            else if (contentType.includes('application/pdf'))
                ext = '.pdf';
            else
                ext = '';
            loggerScope?.debug(`Static resource downloaded successfully`, {
                component: 'PlaywrightBrowser',
                method: 'downloadStaticResource()',
                action: 'success',
                data: {
                    url,
                    ext,
                    contentType,
                    size: buffer.length,
                },
            });
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            loggerScope?.error(`Failed to read response body`, {
                component: 'PlaywrightBrowser',
                method: 'downloadStaticResource()',
                action: 'response.body()',
                data: {
                    url,
                    errorName: error.name,
                    errorMessage: error.message,
                    stack: error.stack,
                },
            });
            throw error;
        }
        return { buffer, ext };
    }
    async downloadWithFallback(url, page, context, loggerScope) {
        loggerScope?.debug(`Entering downloadWithFallback()`, {
            component: 'PlaywrightBrowser',
            method: 'downloadWithFallback()',
            data: { url },
        });
        try {
            //todo пока не понятно что лучше начинать со статики или ней заканчивать....
            // return await this.downloadStaticResource(url, context, loggerScope);
            return await this.download(page, url, loggerScope);
        }
        catch (err) {
            // const error = err instanceof Error ? err : new Error(String(err));
            const { error, meta } = this.normalizeError(err);
            loggerScope?.warn(`Static download failed`, {
                component: 'PlaywrightBrowser',
                method: 'downloadWithFallback()',
                data: {
                    url,
                    errorName: error.name,
                    errorMessage: error.message,
                    err: err,
                },
            });
            // Fallback ТОЛЬКО если это сетевая ошибка
            if (!this.isNetworkError(error)) {
                loggerScope?.warn(`Error is not network-related. Skipping fallback.`, {
                    component: 'PlaywrightBrowser',
                    method: 'downloadWithFallback()',
                    data: { url },
                });
                throw error;
            }
            loggerScope?.warn(`Network error detected. Switching to page download.`, {
                component: 'PlaywrightBrowser',
                method: 'downloadWithFallback()',
                data: { url },
            });
            // return await this.download(page, url, loggerScope);
            return await this.downloadStaticResource(url, context, loggerScope);
        }
    }
    isNetworkError(error) {
        return (error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('socket'));
    }
    normalizeError(err) {
        if (err instanceof Error) {
            return { error: err };
        }
        if (typeof err === 'object' && err !== null) {
            const obj = err;
            const message = typeof obj.message === 'string'
                ? obj.message
                : typeof obj.error?.message === 'string'
                    ? obj.error.message
                    : typeof obj.error?.name === 'string'
                        ? obj.error.name
                        : 'Unknown error';
            return {
                error: new Error(message),
                meta: obj,
            };
        }
        return { error: new Error(String(err)) };
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
