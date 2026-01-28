"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import { ImageResult } from "../../contracts/ImageResult";
class PageImageSource {
    supports(task) {
        return task.type === 'collect_product_photos';
    }
    execute(task, context) {
        throw new Error("Method not implemented.");
    }
}
exports.default = PageImageSource;
