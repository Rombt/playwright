"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRetryable = isRetryable;
function isRetryable(error) {
    if (!error)
        return false;
    // Если это ошибка Playwright с кодом timeout
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        error.retryable = true;
        // таймауты и network glitches
        if (msg.includes('timeout') || msg.includes('net::'))
            return true;
        // если страница динамическая
        if (msg.includes('element not found') || msg.includes('not visible'))
            return true;
    }
    if (error?.retryable === true) {
        error.retryable = true;
        return true;
    }
    error.retryable = false;
    return false;
}
