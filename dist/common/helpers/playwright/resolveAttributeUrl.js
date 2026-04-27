"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAttributeUrl = resolveAttributeUrl;
async function resolveAttributeUrl(element, attribute, baseUrl) {
    const value = await element.getAttribute(attribute);
    if (!value) {
        throw new Error(`Attribute "${attribute}" not found for element (baseUrl: ${baseUrl})`);
    }
    return new URL(value, baseUrl).toString();
}
