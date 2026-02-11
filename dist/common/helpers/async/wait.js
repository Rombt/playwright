"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitBeforeRetry = waitBeforeRetry;
const appConfig_1 = require("../../../data/config/appConfig");
async function waitBeforeRetry(attempt, baseDelay, maxDelay) {
    const cfg = appConfig_1.AppConfig.getInstance();
    const retryCfg = cfg.asyncRetry?.retry;
    const defaultBase = 100;
    const defaultMax = 5000;
    const delay = Math.min((baseDelay ?? retryCfg?.baseDelay ?? defaultBase) * 2 ** (attempt - 1), maxDelay ?? retryCfg?.maxDelay ?? defaultMax);
    return new Promise(resolve => setTimeout(resolve, delay));
}
