"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeHtmlToList = normalizeHtmlToList;
const cheerio_1 = require("cheerio");
function normalizeHtmlToList(html, options = {}) {
    const { containers = [], removeSelectors = [], separator = '\n' } = options;
    const $ = (0, cheerio_1.load)(html);
    sanitizeDom($);
    const roots = resolveContainers($, containers);
    const items = [];
    for (const root of roots) {
        const extracted = extractListItems($, root, removeSelectors);
        items.push(...extracted);
    }
    return buildUl(items, separator);
}
/**
 * Определяем контейнеры внутри HTML
 */
function resolveContainers($, selectors) {
    if (!selectors.length) {
        return [$('body')];
    }
    const result = [];
    selectors.forEach((sel) => {
        $(sel).each((_, el) => {
            result.push($(el));
        });
    });
    return result;
}
/**
 * Базовая очистка DOM
 */
function sanitizeDom($) {
    const remove = [
        'script',
        'style',
        'svg',
        'img',
        'picture',
        'video',
        'iframe',
        'noscript',
        '[aria-hidden="true"]',
        '[hidden]',
    ];
    remove.forEach((sel) => $(sel).remove());
    $('*').each((_, el) => {
        if (el.type !== 'tag')
            return;
        const element = el;
        for (const attr in element.attribs) {
            if (attr === 'style' || attr === 'class' || attr.startsWith('data-')) {
                $(element).removeAttr(attr);
            }
        }
    });
}
/**
 * Извлечение элементов списка из контейнера
 */
function extractListItems($, root, removeSelectors) {
    const clone = root.clone();
    // удаляем пользовательские селекторы
    removeSelectors.forEach((sel) => {
        clone.find(sel).remove();
    });
    // 1. <li>
    const liItems = clone.find('li');
    if (liItems.length) {
        return liItems
            .map((_, el) => cleanText($(el).text()))
            .get()
            .filter(Boolean);
    }
    // 2. <p>
    const paragraphs = clone.find('p');
    if (paragraphs.length) {
        return paragraphs
            .map((_, el) => cleanText($(el).text()))
            .get()
            .filter(Boolean);
    }
    // 3. <br>
    const html = clone.html() || '';
    const parts = html
        .split(/<br\s*\/?>/i)
        .map((s) => cleanText((0, cheerio_1.load)(s).text()))
        .filter(Boolean);
    if (parts.length)
        return parts;
    // 4. fallback
    const text = cleanText(clone.text());
    return text ? [text] : [];
}
/**
 * Очистка текста
 */
function cleanText(text) {
    return text.replace(/\s+/g, ' ').replace(/•/g, '').trim();
}
/**
 * Сборка итогового UL списка
 */
function buildUl(items, separator) {
    const unique = Array.from(new Set(items));
    if (!unique.length)
        return '';
    const li = unique.map((text) => `<li>${text}</li>`).join(separator);
    return `<ul>${separator}${li}${separator}</ul>`;
}
