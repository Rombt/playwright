import { IHtmlProcessorFactory } from './types/IHtmlProcessorFactory';
import { IBaseHtmlProcessor } from './types/IBaseHtmlProcessor';
import { Site } from './types/Site';

import { MTacProcessor } from './processors/MTacProcessor';

export class HtmlProcessorFactory implements IHtmlProcessorFactory {
  public create(site: Site): IBaseHtmlProcessor {
    switch (site) {
      case Site.MTac:
        return new MTacProcessor();

      default:
        throw new Error(`Unsupported site: ${site}`);
    }
  }
}
