"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeDom = sanitizeDom;
// базовый whitelist (структура + форматирование)
const BASE_ALLOWED_TAGS = new Set([
    'div',
    'p',
    'span',
    'br',
    'ul',
    'ol',
    'li',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'strike',
    'small',
    'sub',
    'sup',
]);
// blacklist (приоритет выше)
const BASE_FORBIDDEN_TAGS = new Set([
    'script',
    'style',
    'noscript',
    'iframe',
    'object',
    'embed',
    'svg',
    'canvas',
    'img',
    'video',
    'audio',
    'source',
    'a',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
    // заголовки запрещены
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
]);
function sanitizeDom(dom, options = {}) {
    const { allowedTags = [], forbiddenTags = [] } = options;
    const allowed = new Set([...BASE_ALLOWED_TAGS, ...allowedTags.map((t) => t.toLowerCase())]);
    const forbidden = new Set([...BASE_FORBIDDEN_TAGS, ...forbiddenTags.map((t) => t.toLowerCase())]);
    // работаем ТОЛЬКО внутри body, а не по всему документу
    const root = (dom('body').length ? dom('body') : dom.root());
    root.find('*').each((_, el) => {
        if (el.type !== 'tag')
            return;
        const element = el;
        const tag = element.tagName.toLowerCase();
        // blacklist приоритетнее
        if (forbidden.has(tag)) {
            dom(element).remove();
            return;
        }
        // не в whitelist
        if (!allowed.has(tag)) {
            dom(element).remove();
            return;
        }
    });
    return dom;
}
