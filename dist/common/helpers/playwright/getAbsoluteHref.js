"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAbsoluteHref = getAbsoluteHref;
const resolveAttributeUrl_1 = require("./resolveAttributeUrl");
async function getAbsoluteHref(page, element) {
    return (0, resolveAttributeUrl_1.resolveAttributeUrl)(element, 'href', page.url());
}
