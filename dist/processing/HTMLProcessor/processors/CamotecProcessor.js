"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CamotecProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
class CamotecProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        const cleanHtmlDescription = dom('body').html() ?? '';
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.CamotecProcessor = CamotecProcessor;
