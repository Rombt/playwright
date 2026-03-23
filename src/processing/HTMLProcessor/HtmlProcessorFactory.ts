import { IHtmlProcessorFactory } from './types/IHtmlProcessorFactory';
import { IBaseHtmlProcessor } from './types/IBaseHtmlProcessor';
import { Site } from './types/Site';

import { MTacProcessor } from './processors/MTacProcessor';

export class HtmlProcessorFactory implements IHtmlProcessorFactory {
  private processors: Record<string, new () => IBaseHtmlProcessor> = {
    'm-tac': MTacProcessor,
    // здесь добавлять новые бренды
  };

  public create(brand: string): IBaseHtmlProcessor {
    const ProcessorClass = this.processors[brand.toLowerCase()];

    if (!ProcessorClass) {
      throw new Error(`Unsupported brand: ${brand}`);
    }

    return new ProcessorClass();
  }
}
