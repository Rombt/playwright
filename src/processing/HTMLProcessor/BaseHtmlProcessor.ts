import { load, CheerioAPI } from 'cheerio';
import { IBaseHtmlProcessor } from './types/IBaseHtmlProcessor';
import { IAttribute } from './types/IAttribute';

export abstract class BaseHtmlProcessor implements IBaseHtmlProcessor {
  public process(html: string): IAttribute[] {
    const dom = this.parse(html);

    return this.extractAttributes(dom);
  }

  protected parse(html: string): CheerioAPI {
    return load(html);
  }

  //   protected abstract extractName(dom: CheerioAPI): string;

  //   protected abstract extractDescription(dom: CheerioAPI): string;

  protected abstract extractAttributes(dom: CheerioAPI): IAttribute[];
}
