"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRetryStatus = getRetryStatus;
const RETRYABLE_ERRORS = ['timeout', 'net::', 'network', '503', 'socket', 'econnreset'];
function getRetryStatus(workerError) {
    if (!workerError || !workerError.error)
        return 'fatal';
    const msg = workerError.error instanceof Error
        ? workerError.error.message.toLowerCase()
        : String(workerError.error).toLowerCase();
    const isRetry = RETRYABLE_ERRORS.some((e) => msg.includes(e));
    return isRetry ? 'retriable' : 'fatal';
}
