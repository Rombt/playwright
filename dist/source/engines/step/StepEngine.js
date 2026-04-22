"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepEngine = void 0;
class StepEngine {
    steps;
    constructor(steps) {
        this.steps = steps;
    }
    async execute(ctx) {
        for (const step of this.steps) {
            if (step.supports?.(ctx) ?? true) {
                ctx.logger.info(`Step started: ${step.name}`);
                await step.run(ctx);
                ctx.logger.info(`Step finished: ${step.name}`);
            }
        }
        return ctx.state.result;
    }
}
exports.StepEngine = StepEngine;
