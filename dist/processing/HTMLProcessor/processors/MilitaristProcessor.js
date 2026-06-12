"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MilitaristProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
class MilitaristProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        const description = dom('span[itemprop="description"]').first();
        description.find('h2').remove();
        description.find('*').each((_, el) => {
            const $el = dom(el);
            const isEmpty = !$el.text().trim() && $el.children().length === 0;
            if (isEmpty) {
                $el.remove();
            }
        });
        const cleanHtmlDescription = description.html() ?? '';
        console.log('cleanHtmlDescription = ', cleanHtmlDescription);
        const table = dom('table').first();
        table
            .find('*')
            .addBack()
            .each((_, el) => {
            if ('attribs' in el) {
                el.attribs = {};
            }
        });
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: '',
        };
    }
}
exports.MilitaristProcessor = MilitaristProcessor;
