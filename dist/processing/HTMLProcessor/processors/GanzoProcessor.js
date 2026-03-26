"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GanzoProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
class GanzoProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        dom('body').find('h2').remove();
        const cleanHtmlDescription = dom('body').html() ?? '';
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.GanzoProcessor = GanzoProcessor;
