"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
const path = require("path");
const playwright_1 = require("playwright");
const FingerprintPool_1 = require("../fingerprint/FingerprintPool");
class PlaywrightBrowser {
    constructor(launchOptions, browserContextOptions) {
        this.launchOptions = launchOptions;
        this.browserContextOptions = browserContextOptions;
        this.instance = null;
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
    async close() {
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
    async runInContextByChromium(fn, mode) {
        const userDataDir = path.resolve(mode === 'real' ? './chrome-profile-real' : './chrome-profile-fake');
        const context = await playwright_1.chromium.launchPersistentContext(userDataDir, {
            headless: false,
            channel: 'chrome',
            args: ['--disable-blink-features=AutomationControlled'],
        });
        try {
            return await fn(context);
        }
        finally {
            await context.close();
        }
    }
    async download(page, url) {
        let downloadEvent;
        const downloadPromise = page
            .waitForEvent('download')
            .then((d) => {
            downloadEvent = d;
        })
            .catch(() => { });
        const response = await page.goto(url);
        await downloadPromise;
        if (downloadEvent) {
            const suggestedFilename = downloadEvent.suggestedFilename();
            const ext = path.extname(suggestedFilename) || '.jpg';
            const stream = await downloadEvent.createReadStream();
            if (!stream) {
                throw new Error('Download stream is null');
            }
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
            throw new Error('No response received');
        }
        const buffer = await response.body();
        const contentType = response.headers()['content-type'] || '';
        let ext = '';
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
        return { buffer, ext };
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
