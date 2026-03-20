import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';

export class MTacProcessor extends BaseHtmlProcessor {
  // protected extractName(dom: CheerioAPI): string {
  //   return dom('h1').first().text().trim();
  // }

  // protected extractDescription(dom: CheerioAPI): string {
  //   return dom('.product-description').text().trim();
  // }

  protected extractAttributes(dom: CheerioAPI): IAttribute[] {
    const result: IAttribute[] = [];

    // dom('.characteristics li').each((_, el) => {
    //   const key = dom(el).find('.label').text().trim();
    //   const value = dom(el).find('.value').text().trim();

    //   if (key) {
    //     result[key] = value;
    //   }
    // });

    console.log('======== MTacProcessor.extractAttributes() ==============');

    return result;
  }
}
