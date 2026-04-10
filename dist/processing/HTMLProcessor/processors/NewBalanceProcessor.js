"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewBalanceProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class NewBalanceProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        const result = [];
        // 1. Описание
        dom('.descr-sec__tab-text p').each((_, el) => {
            const text = dom(el).text().trim();
            if (text)
                result.push(text);
        });
        // 2. Характеристики
        dom('.product-info__list li').each((_, li) => {
            const text = dom(li).text().trim();
            if (text)
                result.push(text);
        });
        const unique = Array.from(new Set(result));
        const textHtml = `<ul> ${unique.map((item) => `<li>${item}</li>`).join('\n')} </ul>`;
        const cleanHtmlDescription = textHtml;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.NewBalanceProcessor = NewBalanceProcessor;
