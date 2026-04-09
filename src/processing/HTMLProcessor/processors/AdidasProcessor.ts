import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, removeElementsByFuzzyText } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class AdidasProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    sanitizeDom(dom);

    const blocks = dom('.description-block');

    const resultBlocks: string[][] = [];

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
