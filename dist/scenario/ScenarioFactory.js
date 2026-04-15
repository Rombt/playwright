"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenarioFactory = void 0;
const DefaultScenario_1 = require("./scenarios/DefaultScenario");
const RozetkaScenario_1 = require("./scenarios/RozetkaScenario");
class ScenarioFactory {
    static registry = {
        default: DefaultScenario_1.DefaultScenario,
        rozetka: RozetkaScenario_1.RozetkaScenario,
    };
    static create(name, browser, storage, mode) {
        const Scenario = this.registry[name] || this.registry.default;
        return new Scenario(browser, storage, mode);
    }
}
exports.ScenarioFactory = ScenarioFactory;
