"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagePool = void 0;
class PagePool {
    constructor(context, max) {
        this.context = context;
        this.max = max;
        this.free = [];
        this.created = 0;
        this.waiters = [];
    }
    async acquire() {
        if (this.free.length) {
            return this.free.pop();
        }
        if (this.created < this.max) {
            this.created++;
            return await this.context.newPage();
        }
        return new Promise(resolve => {
            this.waiters.push(resolve);
        });
    }
    release(page) {
        const waiter = this.waiters.shift();
        if (waiter) {
            waiter(page);
        }
        else {
            this.free.push(page);
        }
    }
}
exports.PagePool = PagePool;
