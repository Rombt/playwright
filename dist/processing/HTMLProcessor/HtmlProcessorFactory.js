"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlProcessorFactory = void 0;
const Site_1 = require("./types/Site");
const MTacProcessor_1 = require("./processors/MTacProcessor");
class HtmlProcessorFactory {
    create(site) {
        switch (site) {
            case Site_1.Site.MTac:
                return new MTacProcessor_1.MTacProcessor();
            default:
                throw new Error(`Unsupported site: ${site}`);
        }
    }
}
exports.HtmlProcessorFactory = HtmlProcessorFactory;
