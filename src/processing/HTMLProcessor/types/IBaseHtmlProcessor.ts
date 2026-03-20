import { CheerioAPI } from 'cheerio';
import { IAttribute } from './IAttribute';

export interface IBaseHtmlProcessor {
  process(html: string): IAttribute[];
}

//? показался лишним
// export interface IBaseHtmlExtractor {
//   extractName(dom: CheerioAPI): string;
//   extractDescription(dom: CheerioAPI): string;
//   extractAttributes(dom: CheerioAPI): Record<string, string>;
// }
