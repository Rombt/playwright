"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeElementsByFuzzyText = removeElementsByFuzzyText;
const fast_fuzzy_1 = require("fast-fuzzy");
function removeElementsByFuzzyText(dom, targetText, threshold = 0.8) {
    dom('*').each((_, el) => {
        if (el.type !== 'tag')
            return;
        const element = el;
        const directText = element.children
            .filter((child) => child.type === 'text')
            .map((child) => child.data)
            .join(' ')
            .trim();
        if (!directText)
            return;
        if ((0, fast_fuzzy_1.fuzzy)(targetText, directText) >= threshold) {
            dom(element).remove();
        }
    });
}
