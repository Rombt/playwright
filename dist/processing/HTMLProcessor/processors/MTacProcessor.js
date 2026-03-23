"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MTacProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
class MTacProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        const description = dom('.product-section.right-block').first();
        description.find('h2').remove();
        description.find('*').each((_, el) => {
            const $el = dom(el);
            const isEmpty = !$el.text().trim() && $el.children().length === 0;
            if (isEmpty) {
                $el.remove();
            }
        });
        const cleanHtmlDescription = description.html() ?? '';
        const table = dom('table').first();
        table
            .find('*')
            .addBack()
            .each((_, el) => {
            if ('attribs' in el) {
                el.attribs = {};
            }
        });
        const cleanHtmlTable = dom.html(table);
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.MTacProcessor = MTacProcessor;
