import { IHtmlProcessorFactory } from './types/IHtmlProcessorFactory';
import { IBaseHtmlProcessor } from './types/IBaseHtmlProcessor';
import { Site } from './types/Site';

import { DefaultProcessor } from './processors/DefaultProcessor';
import { MTacProcessor } from './processors/MTacProcessor';
import { MilitaristProcessor } from './processors/MilitaristProcessor';
import { GanzoProcessor } from './processors/GanzoProcessor';
import { CamotecProcessor } from './processors/CamotecProcessor';
import { KiborgProcessor } from './processors/KiborgProcessor';
import { BezetProcessor } from './processors/BezetProcessor';
import { ColumbiaProcessor } from './processors/ColumbiaProcessor';
import { BRSProcessor } from './processors/BRSProcessor';
import { PumaProcessor } from './processors/PumaProcessor';
import { AvecsProcessor } from './processors/AvecsProcessor';
import { AdidasProcessor } from './processors/AdidasProcessor';
import { NewBalanceProcessor } from './processors/NewBalanceProcessor';
import { JomaProcessor } from './processors/JomaProcessor';
import { SalomonProcessor } from './processors/SalomonProcessor';
import { SvastoneProcessor } from './processors/SvastoneProcessor';
import { FenixProcessor } from './processors/FenixProcessor';

export class HtmlProcessorFactory implements IHtmlProcessorFactory {
  private processors: Record<string, new () => IBaseHtmlProcessor> = {
    // 'm-tac': MTacProcessor,  //todo придумать как обрабатывать один бренд разными процессами
    'm-tac': MilitaristProcessor,
    ganzo: GanzoProcessor,
    camotec: CamotecProcessor,
    kiborg: KiborgProcessor,
    bezet: BezetProcessor,
    columbia: ColumbiaProcessor,
    brs: BRSProcessor,
    puma: PumaProcessor,
    avecs: AvecsProcessor,
    adidas: AdidasProcessor,
    'new balance': NewBalanceProcessor,
    joma: JomaProcessor,

    // тестирую DefaultProcessor.ts
    // salomon: SalomonProcessor,
    // svastone: SvastoneProcessor,
    // fenix: FenixProcessor,
  };

  public create(brand: string): IBaseHtmlProcessor {
    // const ProcessorClass = this.processors[brand.toLowerCase()];
    const ProcessorClass = this.processors[brand.toLowerCase()] ?? DefaultProcessor;

    if (!ProcessorClass) {
      throw new Error(`Unsupported brand: ${brand}`);
    }

    return new ProcessorClass();
  }
}
