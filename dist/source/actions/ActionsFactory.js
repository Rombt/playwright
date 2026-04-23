"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionsFactory = void 0;
const Actions_1 = require("../actions/Actions");
class ActionsFactory {
    create(page) {
        return new Actions_1.Actions(page);
    }
}
exports.ActionsFactory = ActionsFactory;
