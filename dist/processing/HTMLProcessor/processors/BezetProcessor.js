"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BezetProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class BezetProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        // удаляем лишнее
        dom('.sc-product-tags').remove();
        (0, helpers_1.removeElementsByFuzzyText)(dom, 'Власне виробництво');
        const text = dom('.sc-product-content-text');
        const textHtml = text.html() ?? '';
        const attributes = dom('.sc-product-content-attributes-list');
        attributes.find('.sc-product-content-attributes-list-title').remove();
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
