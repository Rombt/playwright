"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHtmlProcessor = void 0;
const cheerio_1 = require("cheerio");
class BaseHtmlProcessor {
    process(html) {
        const dom = this.parse(html);
        return this.extractAttributes(dom);
    }
    parse(html) {
        return (0, cheerio_1.load)(html);
    }
}
exports.BaseHtmlProcessor = BaseHtmlProcessor;
