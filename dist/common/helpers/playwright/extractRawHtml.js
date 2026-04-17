"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRawHtml = extractRawHtml;
/**
 * Универсальный extractor сырого HTML из указанных контейнеров.
 *
 * Как работает:
 * 1. Принимает массив контейнеров (селекторы или Playwright Locator).
 * 2. При необходимости раскрывает табы, аккордеоны и другие интерактивные блоки:
 *    - кликает по элементам с aria-expanded
 *    - раскрывает <details>
 *    - активирует типовые tab/accordion кнопки
 *
 * 3. Для каждого контейнера:
 *    - создаёт глубокую копию DOM (cloneNode)
 *    - удаляет нежелательные элементы:
 *      svg, img, picture, video, iframe, canvas, script, style, иконки и т.д.
 *    - дополнительно удаляет элементы, переданные через removeSelectors
 *    - удаляет скрытые элементы ([hidden], [aria-hidden="true"])
 *    - очищает inline-атрибуты (class, style)
 *
 * 4. Собирает очищенный innerHTML каждого контейнера.
 *
 * 5. Возвращает единый результат:
 *    - все блоки объединяются в одну строку
 *    - разделяются заданным separator (по умолчанию перенос строки)
 *
 * Назначение:
 * Получение чистого HTML-контента из сложных UI-страниц (с табами, аккордеонами,
 * галереями и динамическими блоками) для последующего парсинга или анализа.
 */
async function extractRawHtml(page, options) {
    const { containers, removeSelectors = [], expand = true, separator = '\n' } = options;
    const locators = containers.map((c) => (typeof c === 'string' ? page.locator(c) : c));
    if (expand) {
        await expandInteractiveElements(page);
    }
    const results = [];
    const seen = new Set();
    for (const locator of locators) {
        const elements = await locator.all();
        for (const el of elements) {
            const html = await el.evaluate((root, removeSelectors) => {
                const clone = root.cloneNode(true);
                const defaultRemove = [
                    'svg',
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
                // 1. удаляем только визуальный мусор (НЕ hidden контент)
                const allRemove = [...defaultRemove, ...removeSelectors];
                for (const selector of allRemove) {
                    clone.querySelectorAll(selector).forEach((el) => el.remove());
                }
                // 2. НЕ удаляем hidden / aria-hidden / display none
                // потому что нам нужен полный сырой DOM
                // 3. чистим атрибуты (но аккуратно)
                clone.querySelectorAll('*').forEach((el) => {
                    el.removeAttribute('style');
                    el.removeAttribute('class');
                });
                // 4. нормализация текста
                function clean(node) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.textContent = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
                    }
                    node.childNodes.forEach(clean);
                }
                clean(clone);
                return clone.innerHTML.trim();
            }, removeSelectors);
            if (html && !seen.has(html)) {
                seen.add(html);
                results.push(html);
            }
        }
    }
    return results.join(separator).trim();
}
async function expandInteractiveElements(page) {
    // details → просто открыть (без лишней логики)
    await page.locator('details').evaluateAll((els) => {
        els.forEach((el) => {
            el.open = true;
        });
    });
    // aria-expanded
    const expandable = page.locator('[aria-expanded="false"]');
    for (let i = 0; i < (await expandable.count()); i++) {
        try {
            await expandable.nth(i).click({ timeout: 600 });
        }
        catch { }
    }
    // tabs
    const tabs = page.locator('[role="tab"]');
    for (let i = 0; i < (await tabs.count()); i++) {
        try {
            await tabs.nth(i).click({ timeout: 600 });
            await page.waitForTimeout(100);
        }
        catch { }
    }
    // универсальные триггеры
    const triggers = page.locator('button[aria-controls], [data-toggle], [data-target]');
    for (let i = 0; i < (await triggers.count()); i++) {
        try {
            await triggers.nth(i).click({ timeout: 400 });
        }
        catch { }
    }
    // даём DOM догрузиться
    await page.waitForTimeout(500);
}
