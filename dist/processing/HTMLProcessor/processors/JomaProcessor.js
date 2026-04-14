"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JomaProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class JomaProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        const selectors = ['.descr-sec__tab'];
        const resultBlocks = [];
        selectors.forEach((sel) => {
            dom(sel).each((_, block) => {
                const $block = dom(block);
                // Если это ul-блок
                if ($block.is('ul')) {
                    const lines = Array.from(new Set($block
                        .find('li')
                        .map((_, li) => dom(li).text().trim())
                        .get()
                        .filter(Boolean)));
                    if (lines.length)
                        resultBlocks.push(lines);
                }
                else {
                    // Для остальных блоков (p, div)
                    let lines = [];
                    // Выбираем все p и li внутри блока
                    $block.find('p, li').each((_, el) => {
                        const text = dom(el).text().trim();
                        if (text)
                            lines.push(text);
                    });
                    // Фильтруем дубликаты
                    lines = Array.from(new Set(lines));
                    if (lines.length)
                        resultBlocks.push(lines);
                }
            });
        });
        // Генерируем HTML с <ul><li>
        const textHtml = resultBlocks
            .map((lines) => {
            const lis = lines.map((line) => `<li>${line}</li>`).join('\n');
            return `<ul>\n${lis}\n</ul>`;
        })
            .join('\n\n');
        const cleanHtmlDescription = textHtml;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.JomaProcessor = JomaProcessor;
