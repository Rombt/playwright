"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlProcessorFactory = void 0;
const MilitaristProcessor_1 = require("./processors/MilitaristProcessor");
const GanzoProcessor_1 = require("./processors/GanzoProcessor");
const CamotecProcessor_1 = require("./processors/CamotecProcessor");
const KiborgProcessor_1 = require("./processors/KiborgProcessor");
const BezetProcessor_1 = require("./processors/BezetProcessor");
const ColumbiaProcessor_1 = require("./processors/ColumbiaProcessor");
const BRSProcessor_1 = require("./processors/BRSProcessor");
const PumaProcessor_1 = require("./processors/PumaProcessor");
const AvecsProcessor_1 = require("./processors/AvecsProcessor");
class HtmlProcessorFactory {
    processors = {
        // 'm-tac': MTacProcessor,  //todo придумать как обрабатывать один бренд разными процессами
        'm-tac': MilitaristProcessor_1.MilitaristProcessor,
        ganzo: GanzoProcessor_1.GanzoProcessor,
        camotec: CamotecProcessor_1.CamotecProcessor,
        kiborg: KiborgProcessor_1.KiborgProcessor,
        bezet: BezetProcessor_1.BezetProcessor,
        columbia: ColumbiaProcessor_1.ColumbiaProcessor,
        brs: BRSProcessor_1.BRSProcessor,
        puma: PumaProcessor_1.PumaProcessor,
        avecs: AvecsProcessor_1.AvecsProcessor,
        // здесь добавлять новые бренды
    };
    create(brand) {
        const ProcessorClass = this.processors[brand.toLowerCase()];
        if (!ProcessorClass) {
            throw new Error(`Unsupported brand: ${brand}`);
        }
        return new ProcessorClass();
    }
}
exports.HtmlProcessorFactory = HtmlProcessorFactory;
