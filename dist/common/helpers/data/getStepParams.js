"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStepParams = getStepParams;
function getStepParams(ctx, step) {
    if (!ctx.stepParams) {
        throw new Error('stepParams is not initialized');
    }
    const params = ctx.stepParams.get(step);
    if (!params) {
        throw new Error(`Missing params for step ${step.name}`);
    }
    return params;
}
