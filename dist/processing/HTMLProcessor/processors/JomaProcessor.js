"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JomaProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class JomaProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        const cleanHtmlDescription = dom('body').html() ?? '';
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.JomaProcessor = JomaProcessor;
