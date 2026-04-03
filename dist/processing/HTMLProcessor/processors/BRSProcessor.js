"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRSProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class BRSProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        const text = dom('.text');
        const textHtml = text.html() ?? '';
        const cleanHtmlDescription = textHtml;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.BRSProcessor = BRSProcessor;
