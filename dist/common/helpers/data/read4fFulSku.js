"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.read4fFulSku = read4fFulSku;
const XLSX = __importStar(require("xlsx"));
/**
 * Читает XLS-файл и возвращает уникальные артикулы
 * в формате:
 *
 * 4FWAW26TDJAM0935-43S
 * 4FWAW26TDJAM0935-20S
 * 4FWAW26TDJAM0938-20S
 */
function read4fFulSku(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const articles = new Set();
    for (const row of rows) {
        const article = String(row['Артикул'] ?? '').trim();
        const product = String(row['Товари (роботи, послуги)'] ?? '').trim();
        console.log('article =', article);
        console.log('product =', product);
        if (!article || !product) {
            continue;
        }
        // Берём содержимое внутри последних скобок.
        // Например:
        // "4F Куртка DJAM0935 (S, KHAKI, 43S)"
        //                         -> "43S"
        const match = product.match(/\(([^()]*)\)\s*$/);
        if (!match) {
            continue;
        }
        const parts = match[1]
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        const code = parts.at(-1);
        if (!code) {
            continue;
        }
        articles.add(`${article}-${code}`);
    }
    return [...articles];
}
