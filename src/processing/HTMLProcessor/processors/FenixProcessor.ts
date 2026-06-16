import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, normalizeDomToList } from '../../../common/helpers';

export class FenixProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {

        sanitizeDom(dom);

        const listHtml = normalizeDomToList(dom);

    const cleanHtmlTable = '';

    return {
      descriptionHtml: listHtml,
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
