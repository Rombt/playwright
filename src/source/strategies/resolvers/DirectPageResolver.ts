import { Page } from 'playwright';
import { IPageResolver } from './IPageResolver';

export class DirectPageResolver implements IPageResolver {
  async resolve(page: Page, targetUrl: string, debugMeta?: Record<string, string>): Promise<void> {
    // 1. базовый переход
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 2. лёгкая стабилизация DOM
    await this.safeWait(page);
  }

  // =========================
  // SAFE STABILIZATION LAYER
  // =========================

  private async safeWait(page: Page): Promise<void> {
    try {
      // иногда load ещё догружается
      await page.waitForLoadState('load', { timeout: 5000 });
    } catch {
      // игнорируем — SPA может не завершать load
    }

    try {
      // минимальная пауза для SPA hydration
      await page.waitForTimeout(200);
    } catch {
      // никогда не падаем здесь
    }
  }
}
