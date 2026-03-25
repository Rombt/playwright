"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlProcessorFactory = void 0;
const MilitaristProcessor_1 = require("./processors/MilitaristProcessor");
class HtmlProcessorFactory {
    constructor() {
        this.processors = {
            // 'm-tac': MTacProcessor,  //todo придумать как обрабатывать один бренд разными процессами
            'm-tac': MilitaristProcessor_1.MilitaristProcessor,
            // здесь добавлять новые бренды
        };
    }
    create(brand) {
        const ProcessorClass = this.processors[brand.toLowerCase()];
        if (!ProcessorClass) {
            throw new Error(`Unsupported brand: ${brand}`);
        }
        return new ProcessorClass();
    }
}
exports.HtmlProcessorFactory = HtmlProcessorFactory;
