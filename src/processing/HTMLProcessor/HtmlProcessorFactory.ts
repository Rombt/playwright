import { IHtmlProcessorFactory } from './types/IHtmlProcessorFactory';
import { IBaseHtmlProcessor } from './types/IBaseHtmlProcessor';
import { Site } from './types/Site';

import { MTacProcessor } from './processors/MTacProcessor';
import { MilitaristProcessor } from './processors/MilitaristProcessor';
import { GanzoProcessor } from './processors/GanzoProcessor';
import { CamotecProcessor } from './processors/CamotecProcessor';
import { KiborgProcessor } from './processors/KiborgProcessor';

export class HtmlProcessorFactory implements IHtmlProcessorFactory {
  private processors: Record<string, new () => IBaseHtmlProcessor> = {
    // 'm-tac': MTacProcessor,  //todo придумать как обрабатывать один бренд разными процессами
    'm-tac': MilitaristProcessor,
    ganzo: GanzoProcessor,
    camotec: CamotecProcessor,
    kiborg: KiborgProcessor,
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
