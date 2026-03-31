import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, removeElementsByFuzzyText } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class KiborgProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    sanitizeDom(dom);

    // удаляем лишнее
    dom('.sc-product-tags').remove();
    removeElementsByFuzzyText(dom, 'Власне виробництво');

    const text = dom('.sc-product-content-text');
    const textHtml = text.html() ?? '';

    const attributes = dom('.sc-product-content-attributes-list');
    attributes.find('.sc-product-content-attributes-list-title').remove();
    const attributesHtml = attributes.html();

    const cleanHtmlDescription = textHtml + attributesHtml;

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
