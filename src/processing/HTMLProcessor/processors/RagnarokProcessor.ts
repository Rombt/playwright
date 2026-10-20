import { CheerioAPI } from 'cheerio';
import { BaseHtmlProcessor } from '../BaseHtmlProcessor';
import { IAttribute } from '../types/IAttribute';
import { IProductRawContent } from '../types/IProductRawContent';
import { sanitizeDom, removeElementsByFuzzyText } from '../../../common/helpers';
import { fuzzy } from 'fast-fuzzy';

export class RagnarokProcessor extends BaseHtmlProcessor {
  extractRawContent(dom: CheerioAPI): IProductRawContent {
    
    const bodyHtml = dom('body').html() ?? '';
    

    return {
      descriptionHtml: bodyHtml,
      attributesHtml: '',
    };
  }

}
