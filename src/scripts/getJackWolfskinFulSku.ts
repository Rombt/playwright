import { writeFileSync } from 'node:fs';
import { readJackWolfskinFulSku } from '../common/helpers';

const inputPath =
  'F:/testing/playwright/src/data/sku/jackWolfskin/delivery_note_JackWolfskin_all.xls';
const outputPath = 'F:/testing/playwright/src/data/sku/jackWolfskin/jackWolfskin_full_sku.json';

const articles = readJackWolfskinFulSku(inputPath);

writeFileSync(outputPath, JSON.stringify(articles, null, 2), 'utf-8');
