import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, removeElementsByFuzzyText } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class PumaProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    sanitizeDom(dom);

    // удаляем лишнее
    // dom('.sc-product-tags').remove();
    // removeElementsByFuzzyText(dom, 'Власне виробництво');

    // const text = dom('[data-pdp-desc-accordion]');
    // const textHtml = text.html() ?? '';

    const items: string[] = [];

    dom('.accordion-state__item').each((_, item) => {
      const $item = dom(item);

      const content = $item.find('.accordion-state__item-content');

      // берём все list-items__item
      const listItems = content.find('.list-items__item').toArray();

      if (listItems.length > 0) {
        listItems.forEach((li) => {
          const $li = dom(li);
          if ($li.is('[data-pdp-desc-more]')) return;
          const text = $li.text().trim();
          if (text) items.push(text);
        });
      } else {
        // если нет list-items__item, берём весь текст контента
        const text = content.text().trim();
        if (text) items.push(text);
      }
    });

    const cleanHtmlDescription = `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

    const cleanHtmlTable = '';
    return {
      descriptionHtml: cleanHtmlDescription,
      attributesHtml: cleanHtmlTable,
    };
  }

  // protected extractAttributes(dom: CheerioAPI): IAttribute[] {
  //   const result: IAttribute[] = [];

  //   return result;
  // }

  // protected extractName(dom: CheerioAPI): string {
  //   return dom('h1').first().text().trim();
  // }

  // protected extractDescription(dom: CheerioAPI): string {
  //   return dom('.product-description').text().trim();
  // }
}
