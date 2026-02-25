"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutocompleteClient = void 0;
class AutocompleteClient {
    constructor(page, searchInputSelector, apiUrlPart = '/autocomplete/', typeDelayMs = 120) {
        this.page = page;
        this.searchInputSelector = searchInputSelector;
        this.apiUrlPart = apiUrlPart;
        this.typeDelayMs = typeDelayMs;
    }
    async searchBySku(sku) {
        const input = this.page.locator(this.searchInputSelector);
        await input.click();
        await input.fill('');
        const start = Date.now();
        const [response] = await Promise.all([
            this.page.waitForResponse(resp => resp.url().includes(this.apiUrlPart) && resp.request().method() === 'GET'),
            input.type(sku, { delay: this.typeDelayMs }),
        ]);
        const durationMs = Date.now() - start;
        let data = null;
        try {
            data = await response.json();
        }
        catch {
            // намеренно игнорируем — BanDetector решит
        }
        return {
            sku,
            response,
            data,
            durationMs,
        };
    }
}
exports.AutocompleteClient = AutocompleteClient;
