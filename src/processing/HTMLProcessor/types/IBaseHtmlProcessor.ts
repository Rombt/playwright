import { CheerioAPI } from 'cheerio';
import { IAttribute } from './IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';

export interface IBaseHtmlProcessor {
  process(html: string): IAttribute[] | IProductRawContent;
}

//? показался лишним на данном этапе
// export interface IBaseHtmlExtractor {
//   extractName(dom: CheerioAPI): string;
//   extractDescription(dom: CheerioAPI): string;
//   extractAttributes(dom: CheerioAPI): Record<string, string>;
// }
