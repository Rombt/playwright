"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleDescriptionExtractor = void 0;
class SimpleDescriptionExtractor {
    selector;
    constructor(selector) {
        this.selector = selector;
    }
    async extract(page, debugMeta) {
        try {
            // 1. Ждём элемент (но не бесконечно)
            const element = await page.waitForSelector(this.selector, {
                timeout: 5000,
            });
            if (!element) {
                return null;
            }
            // 2. Берём HTML (не textContent!)
            const html = await element.innerHTML();
            // 3. Чистим (минимально)
            const cleaned = html?.trim();
            return cleaned || null;
        }
        catch (e) {
            // не валим pipeline
            return null;
        }
    }
}
exports.SimpleDescriptionExtractor = SimpleDescriptionExtractor;
