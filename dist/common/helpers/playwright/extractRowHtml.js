"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRawHtml = extractRawHtml;
async function extractRawHtml(page, options) {
    const { containers, removeSelectors = [], expand = true } = options;
    const locators = containers.map((c) => (typeof c === 'string' ? page.locator(c) : c));
    // 🔥 1. Раскрываем табы/аккордеоны
    if (expand) {
        await expandInteractiveElements(page);
    }
    const results = [];
    for (const locator of locators) {
        if ((await locator.count()) === 0)
            continue;
        const html = await locator.evaluate((root, removeSelectors) => {
            const clone = root.cloneNode(true);
            // 🔥 2. удаляем мусор по умолчанию
            const defaultRemove = [
                'svg',
                'img',
                'picture',
                'video',
                'canvas',
                'iframe',
                'noscript',
                'style',
                'script',
                '[role="img"]',
                '[class*="icon"]',
            ];
            [...defaultRemove, ...removeSelectors].forEach((selector) => {
                clone.querySelectorAll(selector).forEach((el) => el.remove());
            });
            // 🔥 3. убираем скрытые элементы
            clone.querySelectorAll('[hidden], [aria-hidden="true"]').forEach((el) => {
                el.remove();
            });
            // 🔥 4. чистим атрибуты (опционально можно расширить)
            clone.querySelectorAll('*').forEach((el) => {
                el.removeAttribute('style');
                el.removeAttribute('class');
            });
            return clone.innerHTML.trim();
        }, removeSelectors);
        if (html) {
            results.push(html);
        }
    }
    return results;
}
async function expandInteractiveElements(page) {
    await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        // 🔹 раскрываем <details>
        document.querySelectorAll('details').forEach((el) => {
            el.setAttribute('open', 'true');
        });
        // 🔹 aria-expanded
        document.querySelectorAll('[aria-expanded="false"]').forEach((el) => {
            el.click();
        });
        // 🔹 кнопки табов/аккордеонов
        const triggers = Array.from(document.querySelectorAll('[role="tab"], .tab, .accordion, .collapse, button'));
        for (const el of triggers) {
            try {
                el.click();
                await sleep(100);
            }
            catch { }
        }
    });
    // даём время на DOM обновление
    await page.waitForTimeout(300);
}
