import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, removeElementsByFuzzyText } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class NewBalanceProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    sanitizeDom(dom);

    const result: string[] = [];

    // 1. Описание
    dom('.descr-sec__tab-text p').each((_, el) => {
      const text = dom(el).text().trim();
      if (text) result.push(text);
    });

    // 2. Характеристики
    dom('.product-info__list li').each((_, li) => {
      const text = dom(li).text().trim();
      if (text) result.push(text);
    });

    const unique = Array.from(new Set(result));

    const textHtml = `<ul> ${unique.map((item) => `<li>${item}</li>`).join('\n')} </ul>`;

    const cleanHtmlDescription = textHtml;

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
