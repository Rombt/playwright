"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvecsProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class AvecsProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        const blocks = dom('.description-block');
        const resultBlocks = [];
        blocks.each((_, block) => {
            const htmlContent = dom(block).html() || '';
            const lines = htmlContent
                .replace(/<[^>]+>/g, '')
                .split(/\r?\n|•|-/)
                .map((l) => l.trim())
                .filter(Boolean);
            if (lines.length) {
                resultBlocks.push(lines);
            }
        });
        const ulBlocks = resultBlocks.map((lines) => {
            const lis = lines.map((line) => `<li>${line}</li>`).join('\n');
            return `<ul>\n${lis}\n</ul>`;
        });
        const textHtml = ulBlocks.join('\n\n');
        const cleanHtmlDescription = textHtml;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.AvecsProcessor = AvecsProcessor;
