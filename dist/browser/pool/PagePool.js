"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagePool = void 0;
class PagePool {
    constructor(context, quantityPage) {
        this.context = context;
        this.quantityPage = quantityPage;
        this.free = [];
        this.created = 0;
        this.waiters = [];
    }
    async acquire() {
        if (this.free.length) {
            return this.free.pop();
        }
        if (this.created < this.quantityPage) {
            const page = await this.context.newPage();
            this.created++;
            return page;
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
    async close() {
        // Прекращаем ожидание всех waiters
        for (const waiter of this.waiters) {
            try {
                waiter(Promise.reject(new Error('PagePool is closing')));
            }
            catch { }
        }
        this.waiters = [];
        // Закрываем все свободные страницы
        for (const page of this.free) {
            try {
                await page.close();
            }
            catch (err) {
                console.warn('Error closing page:', err);
            }
        }
        this.free = [];
        this.created = 0;
    }
}
exports.PagePool = PagePool;
