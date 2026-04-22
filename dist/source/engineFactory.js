"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEngine = createEngine;
const StrategyEngine_1 = require("./engines/strategy/StrategyEngine");
const StepEngine_1 = require("./engines/step/StepEngine");
function createEngine(type, steps) {
    switch (type) {
        case 'strategy':
            return new StrategyEngine_1.StrategyEngine();
        case 'step':
            return new StepEngine_1.StepEngine(steps);
        default:
            throw new Error(`Unknown engine: ${type}`);
    }
}
