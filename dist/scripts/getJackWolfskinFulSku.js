"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const helpers_1 = require("../common/helpers");
const inputPath = 'F:/testing/playwright/src/data/sku/jackWolfskin/delivery_note_JackWolfskin_all.xls';
const outputPath = 'F:/testing/playwright/src/data/sku/jackWolfskin/jackWolfskin_full_sku.json';
const articles = (0, helpers_1.readJackWolfskinFulSku)(inputPath);
(0, node_fs_1.writeFileSync)(outputPath, JSON.stringify(articles, null, 2), 'utf-8');
