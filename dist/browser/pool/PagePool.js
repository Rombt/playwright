"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagePool = void 0;
const appConfig_1 = require("../../data/config/appConfig");
class PagePool {
    constructor(context, quantityPage, loggerScope) {
        this.context = context;
        this.quantityPage = quantityPage;
        this.loggerScope = loggerScope;
        this.free = [];
        this.created = 0;
        this.waiters = [];
        this.config = appConfig_1.AppConfig.getInstance();
    }
    async acquire() {
        if (this.free.length) {
            return this.free.pop();
        }
        if (this.created < this.quantityPage) {
            try {
                const page = await this.context.newPage();
                this.created++;
                this.loggerScope?.debug(``, {
                    component: 'PagePool',
                    method: 'acquire',
                    action: 'context.newPage',
                    stage: 'start',
                    data: {
                        created: this.created,
                        page: page,
                    },
                });
                return page;
            }
            catch (error) {
                this.loggerScope?.error('Failed to create new page in pool', {
                    component: 'PagePool',
                    method: 'acquire',
                    action: 'context.newPage',
                    stage: 'start',
                    data: {
                        created: this.created,
                        quantityLimit: this.quantityPage,
                        freePages: this.free.length,
                        waiters: this.waiters.length,
                        errorName: error instanceof Error ? error.name : undefined,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                    },
                });
                throw error; // обязательно пробрасываем
            }
        }
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.waiters = this.waiters.filter((w) => w !== wrappedResolve);
                this.loggerScope?.error('Attempting to create a new page in the pool. Acquire with timeout', {
                    component: 'PagePool',
                    method: 'acquire',
                    action: 'context.newPage',
                    stage: 'process',
                    data: {
                        created: this.created,
                        quantityLimit: this.quantityPage,
                        freePages: this.free.length,
                        waiters: this.waiters.length,
                    },
                });
                reject(new Error('Pool acquire timeout'));
            }, this.config.asyncRetry.maxDelay);
            const wrappedResolve = (page) => {
                clearTimeout(timeout);
                resolve(page);
            };
            if (this.waiters.length >= this.config.asyncPages.maxWaiters) {
                this.loggerScope?.error('Waiters limit exceeded', {
                    component: 'PagePool',
                    method: 'acquire',
                    action: 'enqueue_waiter',
                    stage: 'waiters_limit',
                    data: {
                        currentWaiters: this.waiters.length,
                        maxWaiters: this.config.asyncPages.maxWaiters,
                    },
                });
                return Promise.reject(new Error('Pool waiters limit exceeded'));
            }
            this.waiters.push(wrappedResolve);
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
                // Если использован wrappedResolve
                waiter(Promise.reject(new Error('PagePool is closing')));
            }
            catch (err) {
                this.loggerScope?.warn('Failed to reject waiter on close', {
                    component: 'PagePool',
                    method: 'close',
                    action: 'reject_waiter',
                    stage: 'cleanup',
                    error: err,
                });
            }
        }
        this.waiters = [];
        // Закрываем все свободные страницы
        for (const page of this.free) {
            try {
                await page.close();
            }
            catch (err) {
                this.loggerScope?.warn('Error closing page during pool close', {
                    component: 'PagePool',
                    method: 'close',
                    action: 'page.close',
                    stage: 'cleanup',
                    error: err,
                });
            }
        }
        // Сброс состояния пула
        this.free = [];
        this.created = 0;
    }
}
exports.PagePool = PagePool;
