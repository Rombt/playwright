"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor(intervalMs) {
        this.intervalMs = intervalMs;
        this.lastRun = 0;
    }
    async wait() {
        const now = Date.now();
        const delta = now - this.lastRun;
        if (delta < this.intervalMs) {
            await new Promise(res => setTimeout(res, this.intervalMs - delta));
        }
        this.lastRun = Date.now();
    }
    async schedule(callback) {
        await this.wait();
        const result = await callback();
        return result;
    }
}
exports.RateLimiter = RateLimiter;
