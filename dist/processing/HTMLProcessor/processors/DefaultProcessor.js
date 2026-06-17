"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class DefaultProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        const listHtml = (0, helpers_1.normalizeDomToList)(dom);
        return {
            descriptionHtml: listHtml,
            attributesHtml: '',
        };
    }
}
exports.DefaultProcessor = DefaultProcessor;
