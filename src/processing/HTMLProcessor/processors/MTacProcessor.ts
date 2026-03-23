import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';

export class MTacProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    const description = dom('.product-section.right-block').first();
    description.find('h2').remove();
    description.find('*').each((_, el) => {
      const $el = dom(el);
      const isEmpty = !$el.text().trim() && $el.children().length === 0;
      if (isEmpty) {
        $el.remove();
      }
    });

    const cleanHtmlDescription = description.html() ?? '';

    const table = dom('table').first();
    table
      .find('*')
      .addBack()
      .each((_, el) => {
        if ('attribs' in el) {
          el.attribs = {};
        }
      });
    const cleanHtmlTable = dom.html(table);

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
