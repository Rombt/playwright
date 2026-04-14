import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, removeElementsByFuzzyText } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class JomaProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    sanitizeDom(dom);

    const selectors = ['.descr-sec__tab'];

    const resultBlocks: string[][] = [];

    selectors.forEach((sel) => {
      dom(sel).each((_, block) => {
        const $block = dom(block);

        // Если это ul-блок
        if ($block.is('ul')) {
          const lines = Array.from(
            new Set(
              $block
                .find('li')
                .map((_, li) => dom(li).text().trim())
                .get()
                .filter(Boolean),
            ),
          );

          if (lines.length) resultBlocks.push(lines);
        } else {
          // Для остальных блоков (p, div)
          let lines: string[] = [];

          // Выбираем все p и li внутри блока
          $block.find('p, li').each((_, el) => {
            const text = dom(el).text().trim();
            if (text) lines.push(text);
          });

          // Фильтруем дубликаты
          lines = Array.from(new Set(lines));

          if (lines.length) resultBlocks.push(lines);
        }
      });
    });

    // Генерируем HTML с <ul><li>
    const textHtml = resultBlocks
      .map((lines) => {
        const lis = lines.map((line) => `<li>${line}</li>`).join('\n');
        return `<ul>\n${lis}\n</ul>`;
      })
      .join('\n\n');

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
