import { Page, Frame } from "playwright";

import { IPage } from "../IPage";

export class PlaywrightPageAdapter implements IPage {
  protected page: Page | Frame;

  constructor(page: Page | Frame) {
    this.page = page;
  }

  // =====================
  // Навигация
  // =====================

  async goto(url: string): Promise<void> {
    if (!("goto" in this.page)) {
      throw new Error("goto() is not supported in Frame context");
    }
    await this.page.goto(url);
  }

  // =====================
  // Базовые действия
  // =====================

  async click(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  async dblclick(selector: string): Promise<void> {
    await this.page.dblclick(selector);
  }

  async hover(selector: string): Promise<void> {
    await this.page.hover(selector);
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async check(selector: string): Promise<void> {
    await this.page.check(selector);
  }

  async uncheck(selector: string): Promise<void> {
    await this.page.uncheck(selector);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value);
  }

  // =====================
  // Ожидания
  // =====================

  async waitForSelector(selector: string, timeout?: number): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  // =====================
  // Получение данных
  // =====================

  async getText(selector: string): Promise<string> {
    const el = await this.page.waitForSelector(selector);
    if (!el) {
      throw new Error(`Element not found: ${selector}`);
    }
    return await el.innerText();
  }

  async getAttribute(selector: string, attr: string): Promise<string | null> {
    const el = await this.page.waitForSelector(selector);
    if (!el) {
      throw new Error(`Element not found: ${selector}`);
    }
    return await el.getAttribute(attr);
  }

  async isVisible(selector: string): Promise<boolean> {
    return await this.page.isVisible(selector);
  }

  // =====================
  // Страница
  // =====================

  async scrollToEnd(): Promise<void> {
    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
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

  async screenshot(options?: { path?: string }): Promise<void> {
    if (!("screenshot" in this.page)) {
      throw new Error("screenshot() is not supported in Frame context");
    }
    await this.page.screenshot(options);
  }

  // =====================
  // JS контекст страницы
  // =====================

  async evaluate<T>(fn: () => T): Promise<T> {
    return await this.page.evaluate(fn);
  }

  // =====================
  // Клавиатура
  // =====================

  async keyboardType(text: string): Promise<void> {
    if (!("keyboard" in this.page)) {
      throw new Error("keyboard is not supported in Frame context");
    }
    await this.page.keyboard.type(text);
  }

  async keyboardPress(key: string): Promise<void> {
    if (!("keyboard" in this.page)) {
      throw new Error("keyboard is not supported in Frame context");
    }
    await this.page.keyboard.press(key);
  }

  // =====================
  // Viewport
  // =====================

  async setViewportSize(width: number, height: number): Promise<void> {
    if (!("setViewportSize" in this.page)) {
      throw new Error("setViewportSize() is not supported in Frame context");
    }
    await this.page.setViewportSize({ width, height });
  }

  // =====================
  // Iframe
  // =====================

  async frame(selector: string): Promise<IPage> {
    const handle = await this.page.waitForSelector(selector);
    if (!handle) {
      throw new Error(`Frame not found: ${selector}`);
    }

    const frame = await handle.contentFrame();
    if (!frame) {
      throw new Error(`Element is not a frame: ${selector}`);
    }

    return new PlaywrightPageAdapter(frame);
  }

  // =====================
  // Жизненный цикл
  // =====================

  async close(): Promise<void> {
    if (!("close" in this.page)) {
      throw new Error("close() is not supported in Frame context");
    }
    await this.page.close();
  }
}
