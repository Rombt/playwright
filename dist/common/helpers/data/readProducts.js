"use strict";
// src/common/helpers/data/readProducts.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProducts = readProducts;
const fs = require("fs");
function readProducts(filePath) {
    if (!fs.existsSync(filePath))
        return [];
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const products = JSON.parse(content);
        return Array.isArray(products) ? products : [];
    }
    catch (err) {
        console.error(`Error reading products from ${filePath}:`, err);
        return [];
    }
}
