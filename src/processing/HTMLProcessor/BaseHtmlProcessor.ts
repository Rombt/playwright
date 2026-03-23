import { load, CheerioAPI } from 'cheerio';
import { IBaseHtmlProcessor } from './types/IBaseHtmlProcessor';
import { IAttribute } from './types/IAttribute';
import { IProductRawContent } from './types/IProductRawContent';

export abstract class BaseHtmlProcessor implements IBaseHtmlProcessor {
  public process(html: string): IAttribute[] | IProductRawContent {
    const dom = this.parse(html);

    // return this.extractAttributes(dom);
    return this.extractRawContent(dom);
  }

  protected parse(html: string): CheerioAPI {
    return load(html);
  }

  protected abstract extractRawContent(dom: CheerioAPI): IProductRawContent;

  // когда нужно будет извлекать атрибуты для свойств товара
  // protected abstract extractAttributes(dom: CheerioAPI): IAttribute[];
  //   protected abstract extractName(dom: CheerioAPI): string;
  //   protected abstract extractDescription(dom: CheerioAPI): string;
}
