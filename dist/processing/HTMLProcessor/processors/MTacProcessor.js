"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MTacProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
class MTacProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    // protected extractName(dom: CheerioAPI): string {
    //   return dom('h1').first().text().trim();
    // }
    // protected extractDescription(dom: CheerioAPI): string {
    //   return dom('.product-description').text().trim();
    // }
    extractAttributes(dom) {
        const result = [];
        // dom('.characteristics li').each((_, el) => {
        //   const key = dom(el).find('.label').text().trim();
        //   const value = dom(el).find('.value').text().trim();
        //   if (key) {
        //     result[key] = value;
        //   }
        // });
        console.log('======== MTacProcessor.extractAttributes() ==============');
        return result;
    }
}
exports.MTacProcessor = MTacProcessor;
