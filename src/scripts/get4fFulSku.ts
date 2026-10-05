import { writeFileSync } from 'node:fs';
import { read4fFulSku } from '../common/helpers';

const inputPath = 'F:/testing/playwright/src/data/sku/4f/delivery_note_4F_all.xls';
const outputPath = 'F:/testing/playwright/src/data/sku/4f/4F_full_sku.json';

const articles = read4fFulSku(inputPath);

writeFileSync(outputPath, JSON.stringify(articles, null, 2), 'utf-8');
