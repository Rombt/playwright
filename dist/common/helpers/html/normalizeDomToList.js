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
    removeSelectors.forEach((sel) => {
        clone.find(sel).remove();
    });
    // 1. LI
    const liItems = clone.find('li');
    if (liItems.length) {
        const result = [];
        liItems.each((_, el) => {
            const text = cleanText($(el).text());
            if (text)
                result.push(text);
        });
        return result;
    }
    // 2. P
    const paragraphs = clone.find('p');
    if (paragraphs.length) {
        const result = [];
        paragraphs.each((_, el) => {
            const text = cleanText($(el).text());
            if (text)
                result.push(text);
        });
        return result;
    }
    // 3. BR split (ВАЖНО: без load!)
    const html = clone.html() || '';
    const parts = [];
    html.split(/<br\s*\/?>/i).forEach((s) => {
        const text = cleanText($(s).text());
        if (text)
            parts.push(text);
    });
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
    const li = unique.map((t) => `<li>${t}</li>`).join(separator);
    return `<ul>${separator}${li}${separator}</ul>`;
}
