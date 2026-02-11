"use strict";
// src/common/helpers/data/writeProducts.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeProducts = writeProducts;
const fs = require("fs");
function writeProducts(filePath, products) {
    try {
        const content = JSON.stringify(products, null, 2); // форматированный JSON
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    catch (err) {
        console.error(`Error writing products to ${filePath}:`, err);
    }
}
