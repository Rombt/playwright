"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
class DefaultScenario {
    constructor(source, browser, storage) {
        this.source = source;
        this.browser = browser;
        this.storage = storage;
    }
    async run() {
        console.log("this.browser.runInContext = ", this.browser.runInContext);
        this.browser.runInContext(async (context) => {
        });
    }
    load() {
        throw new Error("Method not implemented.");
    }
    prepare() {
        throw new Error("Method not implemented.");
    }
    process(tasks) {
        throw new Error("Method not implemented.");
    }
    handleError(error) {
        throw new Error("Method not implemented.");
    }
    finalize() {
        throw new Error("Method not implemented.");
    }
}
exports.DefaultScenario = DefaultScenario;
