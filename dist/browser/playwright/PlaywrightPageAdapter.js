"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightPageAdapter = void 0;
class PlaywrightPageAdapter {
    constructor(context) {
        this.context = context;
    }
    static async create(context) {
        const adapter = new PlaywrightPageAdapter(context);
        adapter.page = await context.newPage();
        return adapter;
    }
    frame(selector) {
        throw new Error("Method not implemented.");
    }
    // =====================
    // Навигация
    // =====================
    async goto(url) {
        if (!("goto" in this.page)) {
            throw new Error("goto() is not supported in Frame context");
        }
        await this.page.goto(url);
    }
    // =====================
    // Базовые действия
    // =====================
    async click(selector) {
        await this.page.click(selector);
    }
    async dblclick(selector) {
        await this.page.dblclick(selector);
    }
    async hover(selector) {
        await this.page.hover(selector);
    }
    async fill(selector, value) {
        await this.page.fill(selector, value);
    }
    async check(selector) {
        await this.page.check(selector);
    }
    async uncheck(selector) {
        await this.page.uncheck(selector);
    }
    async selectOption(selector, value) {
        await this.page.selectOption(selector, value);
    }
    // =====================
    // Ожидания
    // =====================
    async waitForSelector(selector, timeout) {
        await this.page.waitForSelector(selector, { timeout });
    }
    async waitForTimeout(ms) {
        await this.page.waitForTimeout(ms);
    }
    // =====================
    // Получение данных
    // =====================
    async getText(selector) {
        const el = await this.page.waitForSelector(selector);
        if (!el) {
            throw new Error(`Element not found: ${selector}`);
        }
        return await el.innerText();
    }
    async getAttribute(selector, attr) {
        const el = await this.page.waitForSelector(selector);
        if (!el) {
            throw new Error(`Element not found: ${selector}`);
        }
        return await el.getAttribute(attr);
    }
    async isVisible(selector) {
        return await this.page.isVisible(selector);
    }
    // =====================
    // Страница
    // =====================
    async scrollToEnd() {
        await this.page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }
    async screenshot(options) {
        if (!("screenshot" in this.page)) {
            throw new Error("screenshot() is not supported in Frame context");
        }
        await this.page.screenshot(options);
    }
    // =====================
    // JS контекст страницы
    // =====================
    async evaluate(fn) {
        return await this.page.evaluate(fn);
    }
    // =====================
    // Клавиатура
    // =====================
    async keyboardType(text) {
        if (!("keyboard" in this.page)) {
            throw new Error("keyboard is not supported in Frame context");
        }
        await this.page.keyboard.type(text);
    }
    async keyboardPress(key) {
        if (!("keyboard" in this.page)) {
            throw new Error("keyboard is not supported in Frame context");
        }
        await this.page.keyboard.press(key);
    }
    // =====================
    // Viewport
    // =====================
    async setViewportSize(width, height) {
        if (!("setViewportSize" in this.page)) {
            throw new Error("setViewportSize() is not supported in Frame context");
        }
        await this.page.setViewportSize({ width, height });
    }
    // =====================
    // Iframe
    // =====================
    //   async frame(selector: string): Promise<IPage> {
    //     const handle = await this.page.waitForSelector(selector);
    //     if (!handle) {
    //       throw new Error(`Frame not found: ${selector}`);
    //     }
    //     const frame = await handle.contentFrame();
    //     if (!frame) {
    //       throw new Error(`Element is not a frame: ${selector}`);
    //     }
    //     return new PlaywrightPageAdapter(frame);
    //   }
    // =====================
    // Жизненный цикл
    // =====================
    async close() {
        if (!("close" in this.page)) {
            throw new Error("close() is not supported in Frame context");
        }
        await this.page.close();
    }
}
exports.PlaywrightPageAdapter = PlaywrightPageAdapter;
