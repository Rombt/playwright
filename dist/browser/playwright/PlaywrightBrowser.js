"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
const playwright_1 = require("playwright");
const path = require("path");
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
            await this.instance.close();
        }
        catch (err) {
            console.warn('Error closing browser:', err);
        }
        finally {
            this.instance = null;
        }
        console.log('Browser closed.');
    }
    async createContext() {
        const browser = await this.init();
        return await browser.newContext(this.browserContextOptions);
    }
    async runInContext(fn) {
        const context = await this.createContext();
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
            const filename = downloadEvent.suggestedFilename();
            const stream = await downloadEvent.createReadStream();
            if (!stream) {
                throw new Error('Download stream is null');
            }
            const chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            return {
                filename,
                buffer: Buffer.concat(chunks),
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
        const baseName = path.basename(new URL(url).pathname) || 'file';
        const filename = baseName + ext;
        return { filename, buffer };
    }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
