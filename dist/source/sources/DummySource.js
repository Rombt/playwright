"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import { ImageResult } from "../../contracts/ImageResult";
class DummySource {
    supports(task) {
        return false;
    }
    execute(task, context) {
        throw new Error("Method not implemented.");
    }
}
exports.default = DummySource;
