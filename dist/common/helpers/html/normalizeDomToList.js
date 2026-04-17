"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDomToList = normalizeDomToList;
function normalizeDomToList($, options = {}) {
    const { containers = [], removeSelectors = [], separator = '\n' } = options;
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
    for (const sel of selectors) {
        $(sel).each((_, el) => {
            result.push($(el));
        });
    }
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
        // '[aria-hidden="true"]',
        // '[hidden]',
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
    removeSelectors.forEach((sel) => {
        clone.find(sel).remove();
    });
    const items = [];
    // =========================
    // 1. DETAILS / ACCORDION
    // =========================
    clone.find('details').each((_, el) => {
        const $el = $(el);
        const title = cleanText($el.find('summary').first().text());
        // берём ВСЁ кроме summary
        const bodyClone = $el.clone();
        bodyClone.find('summary').remove();
        const bodyText = cleanText(bodyClone.text());
        if (bodyText) {
            items.push(title ? `${title}: ${bodyText}` : bodyText);
        }
    });
    // =========================
    // 2. LI
    // =========================
    const liItems = clone.find('li');
    if (liItems.length) {
        liItems.each((_, el) => {
            const text = cleanText($(el).text());
            if (text)
                items.push(text);
        });
    }
    // =========================
    // 3. P (НО только НЕ внутри details)
    // =========================
    const paragraphs = clone.find('p');
    if (paragraphs.length) {
        paragraphs.each((_, el) => {
            const $p = $(el);
            // избегаем дубля если уже обработали details
            if ($p.closest('details').length)
                return;
            const text = cleanText($p.text());
            if (text)
                items.push(text);
        });
    }
    // =========================
    // 4. BR fallback
    // =========================
    const html = clone.html() || '';
    const parts = [];
    clone.contents().each((_, node) => {
        const el = $(node);
        if (el.is('details')) {
            const title = cleanText(el.find('summary').first().text());
            const bodyText = cleanText(el.clone().find('summary').remove().end().text());
            if (bodyText) {
                parts.push(title ? `${title}: ${bodyText}` : bodyText);
            }
            return;
        }
        // 2. paragraphs
        if (el.is('p')) {
            const text = cleanText(el.text());
            if (text)
                parts.push(text);
            return;
        }
        // 3. fallback text nodes
        const text = cleanText(el.text());
        if (text)
            parts.push(text);
    });
    if (parts.length) {
        items.push(...parts);
    }
    // =========================
    // 5. fallback
    // =========================
    if (!items.length) {
        const text = cleanText(clone.text());
        if (text)
            items.push(text);
    }
    return items;
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
    const li = unique.map((t) => `<li>${t}</li>`).join(separator);
    return `<ul>${separator}${li}${separator}</ul>`;
}
