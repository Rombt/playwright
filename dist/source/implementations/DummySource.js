"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DummySource = void 0;
class DummySource {
    async collect(task, browser) {
        console.log("Collect for", task.sku);
        return [];
    }
}
exports.DummySource = DummySource;
