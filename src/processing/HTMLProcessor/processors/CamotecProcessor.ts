import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';

export class CamotecProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    const cleanHtmlDescription = dom('body').html() ?? '';
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
