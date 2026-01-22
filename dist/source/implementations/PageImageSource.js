"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageImageSource = void 0;
class PageImageSource {
    async collect(task, browser) {
        if (!task.sku)
            return [];
        // Получаем HTML (можно использовать для анализа)
        const html = await browser.getHtml();
        // Простейший поиск картинок: img[src]
        const results = [];
        const imgSelector = "img"; // минимальный пример
        const hasImages = await browser.find(imgSelector);
        if (hasImages) {
            // Для примера: просто достаем один атрибут src
            const src = await browser.getAttribute(imgSelector, "src");
            if (src) {
                results.push({
                    sku: task.sku,
                    url: src,
                    fileName: `${task.sku}.jpg`,
                });
            }
        }
        return results;
    }
}
exports.PageImageSource = PageImageSource;
