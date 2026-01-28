"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagePool = void 0;
class PagePool {
    constructor(context, size) {
        this.context = context;
        this.size = size;
        this.pages = [];
    }
    async init() {
        for (let i = 0; i < this.size; i++) {
            this.pages.push(await this.context.newPage());
        }
        return this.pages;
    }
    async destroy() {
        await Promise.all(this.pages.map(p => p.close()));
    }
}
exports.PagePool = PagePool;
