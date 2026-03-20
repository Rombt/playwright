import { CheerioAPI } from 'cheerio';
import { IProductCharacteristics } from './IAttribute';

export interface IBaseHtmlProcessor {
  process(html: string): IProductCharacteristics;
}

//? показался лишним
// export interface IBaseHtmlExtractor {
//   extractName(dom: CheerioAPI): string;
//   extractDescription(dom: CheerioAPI): string;
//   extractAttributes(dom: CheerioAPI): Record<string, string>;
// }
