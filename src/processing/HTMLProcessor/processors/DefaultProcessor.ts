import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, normalizeDomToList } from '../../../common/helpers';

export class DefaultProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    sanitizeDom(dom);

    const listHtml = normalizeDomToList(dom);

    return {
      descriptionHtml: listHtml,
      attributesHtml: '',
    };
  }
}
