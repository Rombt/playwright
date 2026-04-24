"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepFactory = void 0;
class StepFactory {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    create(name, ctx) {
        if (!this.registry.has(name)) {
            throw new Error(`Step not registered: ${name}`);
        }
        const StepClass = this.registry.get(name);
        return new StepClass(ctx);
    }
    has(name) {
        return this.registry.has(name);
    }
    getAvailableSteps() {
        return Array.from(this.registry.getAll().keys());
    }
}
exports.StepFactory = StepFactory;
