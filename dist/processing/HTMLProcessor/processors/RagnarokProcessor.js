"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagnarokProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
class RagnarokProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        const bodyHtml = dom('body').html() ?? '';
        return {
            descriptionHtml: bodyHtml,
            attributesHtml: '',
        };
    }
}
exports.RagnarokProcessor = RagnarokProcessor;
