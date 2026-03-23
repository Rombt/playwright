"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlProcessorFactory = void 0;
const MTacProcessor_1 = require("./processors/MTacProcessor");
class HtmlProcessorFactory {
    constructor() {
        this.processors = {
            'm-tac': MTacProcessor_1.MTacProcessor,
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
