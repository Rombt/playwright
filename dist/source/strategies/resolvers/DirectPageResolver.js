"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectPageResolver = void 0;
class DirectPageResolver {
    async resolve(page, targetUrl, debugMeta) {
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
    async safeWait(page) {
        try {
            // иногда load ещё догружается
            await page.waitForLoadState('load', { timeout: 5000 });
        }
        catch {
            // игнорируем — SPA может не завершать load
        }
        try {
            // минимальная пауза для SPA hydration
            await page.waitForTimeout(200);
        }
        catch {
            // никогда не падаем здесь
        }
    }
}
exports.DirectPageResolver = DirectPageResolver;
