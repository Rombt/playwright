"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitBeforeRetry = waitBeforeRetry;
const appConfig_1 = require("../../../config/appConfig");
async function waitBeforeRetry(attempt, baseDelay, maxDelay) {
    const delay = Math.min((baseDelay ?? appConfig_1.appConfig.async.retry.baseDelay) * 2 ** (attempt - 1), maxDelay ?? appConfig_1.appConfig.async.retry.maxDelay);
    return new Promise(resolve => setTimeout(resolve, delay));
}
