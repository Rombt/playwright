import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, normalizeDomToList } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class SvastoneProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    const listHtml = normalizeDomToList(dom);

    // const result: string[] = [];
    // dom('details.spoilers__item').each((_, el) => {
    //   const $el = dom(el);

    //   const title = $el.find('summary.spoilers__title').first().text().trim();
    //   const body = $el.find('.spoilers__body .text').first();

    //   const bodyHtml = body.html()?.trim();

    //   if (!title && !bodyHtml) return;

    //   // 3. Формируем <li>
    //   const li = `
    //         <li>
    //           ${title ? `<strong>${title}</strong>` : ''}
    //           ${bodyHtml ? `<div>${bodyHtml}</div>` : ''}
    //         </li>
    //       `;

    //   result.push(li);
    // });
    // const listHtml = `<ul>${result.join('')}</ul>`;

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
