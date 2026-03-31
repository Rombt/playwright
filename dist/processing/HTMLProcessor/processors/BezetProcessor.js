"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BezetProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class BezetProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        // удаляем лишнее
        // dom('.sc-product-tags').remove();
        // removeElementsByFuzzyText(dom, 'Власне виробництво');
        const text = dom('#desc > #hidd');
        const textHtml = text.html() ?? '';
        const attributes = dom('#details');
        const attributesHtml = attributes.html();
        const cleanHtmlDescription = textHtml + attributesHtml;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.BezetProcessor = BezetProcessor;
