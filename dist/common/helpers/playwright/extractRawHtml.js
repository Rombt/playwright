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
    for (const locator of locators) {
        const elements = await locator.all();
        for (const el of elements) {
            const html = await el.evaluate((root, removeSelectors) => {
                const clone = root.cloneNode(true);
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
                // удаляем мусор
                [...defaultRemove, ...removeSelectors].forEach((selector) => {
                    clone.querySelectorAll(selector).forEach((el) => el.remove());
                });
                // скрытые элементы
                clone.querySelectorAll('[hidden], [aria-hidden="true"]').forEach((el) => el.remove());
                // чистим атрибуты
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
    }
    return results.join(separator).trim();
}
async function expandInteractiveElements(page) {
    // 1. details
    const details = page.locator('details:not([open])');
    const countDetails = await details.count();
    for (let i = 0; i < countDetails; i++) {
        await details.nth(i).evaluate((el) => {
            el.open = true;
        });
    }
    // 2. aria-expanded
    const expandable = page.locator('[aria-expanded="false"]');
    const countExpandable = await expandable.count();
    for (let i = 0; i < countExpandable; i++) {
        const el = expandable.nth(i);
        try {
            await el.click({ timeout: 1000 });
        }
        catch { }
    }
    // 3. табы (role=tab)
    const tabs = page.locator('[role="tab"]');
    const countTabs = await tabs.count();
    for (let i = 0; i < countTabs; i++) {
        try {
            await tabs.nth(i).click({ timeout: 1000 });
            await page.waitForTimeout(100);
        }
        catch { }
    }
    // 4. частые классы (аккордеоны)
    const triggers = page.locator('.accordion, .collapse, .tab, button[aria-controls]');
    const countTriggers = await triggers.count();
    for (let i = 0; i < countTriggers; i++) {
        try {
            await triggers.nth(i).click({ timeout: 500 });
        }
        catch { }
    }
    // финальное ожидание
    await page.waitForLoadState('networkidle').catch(() => { });
    await page.waitForTimeout(300);
}
