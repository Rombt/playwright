"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultScenario = void 0;
class DefaultScenario {
    constructor(source, browser, storage) {
        this.source = source;
        this.browser = browser;
        this.storage = storage;
        this.maxRetries = 10;
        this.baseDelay = 500;
        this.maxDelay = 5000;
    }
    async run() {
        console.log("this.browser.runInContext = ", this.browser.runInContext);
        this.browser.runInContext(async (context) => {
            try {
                // await page.goto(url);
                // await page.click(".submit");
            }
            catch (err) {
                await this.handleError(err); // все retries внутри handleError
            }
        });
    }
    load() {
        throw new Error("Method not implemented.");
    }
    prepare() {
        throw new Error("Method not implemented.");
    }
    process(tasks) {
        throw new Error("Method not implemented.");
    }
    async handleError(error, attempt = 1) {
        // 1. Логирование
        console.error(`Error on attempt ${attempt}:`, error);
        // 2. Проверка, можно ли повторить
        if (attempt < this.maxRetries && this.isRetryable(error)) {
            await this.waitBeforeRetry(attempt); // опциональная пауза
            return this.handleError(error, attempt + 1); // повторяем
        }
        // 3. Если retries закончились — выбросить или сохранить состояние
        throw error;
    }
    finalize() {
        throw new Error("Method not implemented.");
    }
    isRetryable(error) {
        if (!error)
            return false;
        // 1️⃣ Если это ошибка Playwright с кодом timeout
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            // таймауты и network glitches считаются retryable
            if (msg.includes("timeout") || msg.includes("net::"))
                return true;
            // иногда полезно повторять ошибки типа "element not found", если страница динамическая
            if (msg.includes("element not found") || msg.includes("not visible"))
                return true;
        }
        // 2️⃣ Можно добавить свои кастомные классы ошибок
        if (error?.retryable === true)
            return true;
        // 3️⃣ Всё остальное — критические ошибки, retry не делаем
        return false;
    }
    async waitBeforeRetry(attempt) {
        // экспоненциальный рост: baseDelay * 2^(attempt-1)
        const delay = Math.min(this.baseDelay * 2 ** (attempt - 1), this.maxDelay);
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
}
exports.DefaultScenario = DefaultScenario;
