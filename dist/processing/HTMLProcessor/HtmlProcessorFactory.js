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
const AdidasProcessor_1 = require("./processors/AdidasProcessor");
const NewBalanceProcessor_1 = require("./processors/NewBalanceProcessor");
const JomaProcessor_1 = require("./processors/JomaProcessor");
const SalomonProcessor_1 = require("./processors/SalomonProcessor");
const SvastoneProcessor_1 = require("./processors/SvastoneProcessor");
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
        adidas: AdidasProcessor_1.AdidasProcessor,
        'new balance': NewBalanceProcessor_1.NewBalanceProcessor,
        joma: JomaProcessor_1.JomaProcessor,
        salomon: SalomonProcessor_1.SalomonProcessor,
        svastone: SvastoneProcessor_1.SvastoneProcessor,
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
