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
    const { containers, removeSelectors = [], separator = '\n' } = options;
    const locators = containers.map((c) => typeof c === 'string' ? page.locator(c) : c);
    // мягкое раскрытие (НЕ критичное)
    await softExpand(page);
    const results = [];
    const seen = new Set();
    for (const locator of locators) {
        const elements = await locator.all();
        for (const el of elements) {
            const data = await el.evaluate((root, removeSelectors) => {
                const clone = root.cloneNode(true);
                const remove = [
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
                    ...removeSelectors,
                ];
                // удалить мусор
                for (const sel of remove) {
                    clone.querySelectorAll(sel).forEach((n) => n.remove());
                }
                // нормализация текста (главный фикс)
                // const text = clone.innerText
                //   .replace(/\s+\n/g, '\n')
                //   .replace(/\n\s+/g, '\n')
                //   .replace(/[ \t]+/g, ' ')
                //   .trim();
                // return text;
                return clone.innerHTML.trim();
            }, removeSelectors);
            if (data && !seen.has(data)) {
                seen.add(data);
                results.push(data);
            }
        }
    }
    return results.join(separator).trim();
}
async function softExpand(page) {
    // details
    await page.locator('details').evaluateAll((els) => {
        els.forEach((el) => (el.open = true));
    });
    // aria-expanded
    const exp = page.locator('[aria-expanded="false"]');
    for (let i = 0; i < (await exp.count()); i++) {
        try {
            await exp.nth(i).click({ timeout: 400 });
        }
        catch { }
    }
    // tabs (очень осторожно)
    const tabs = page.locator('[role="tab"]');
    for (let i = 0; i < (await tabs.count()); i++) {
        try {
            await tabs.nth(i).click({ timeout: 400 });
            await page.waitForTimeout(80);
        }
        catch { }
    }
    await page.waitForTimeout(300);
}
