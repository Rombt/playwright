"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PumaProcessor = void 0;
const BaseHtmlProcessor_1 = require("../BaseHtmlProcessor");
const helpers_1 = require("../../../common/helpers");
class PumaProcessor extends BaseHtmlProcessor_1.BaseHtmlProcessor {
    extractRawContent(dom) {
        (0, helpers_1.sanitizeDom)(dom);
        // удаляем лишнее
        // dom('.sc-product-tags').remove();
        // removeElementsByFuzzyText(dom, 'Власне виробництво');
        // const text = dom('[data-pdp-desc-accordion]');
        // const textHtml = text.html() ?? '';
        const items = [];
        dom('.accordion-state__item').each((_, item) => {
            const $item = dom(item);
            const content = $item.find('.accordion-state__item-content');
            // берём все list-items__item
            const listItems = content.find('.list-items__item').toArray();
            if (listItems.length > 0) {
                listItems.forEach((li) => {
                    const $li = dom(li);
                    if ($li.is('[data-pdp-desc-more]'))
                        return;
                    const text = $li.text().trim();
                    if (text)
                        items.push(text);
                });
            }
            else {
                // если нет list-items__item, берём весь текст контента
                const text = content.text().trim();
                if (text)
                    items.push(text);
            }
        });
        const cleanHtmlDescription = `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
        const cleanHtmlTable = '';
        return {
            descriptionHtml: cleanHtmlDescription,
            attributesHtml: cleanHtmlTable,
        };
    }
}
exports.PumaProcessor = PumaProcessor;
