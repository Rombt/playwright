"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizePageResources = optimizePageResources;
/**
 * Оптимизирует страницу для автоматизированной обработки:
 *
 * - отключает CSS-анимации и transition-эффекты;
 * - блокирует загрузку изображений;
 * - блокирует загрузку шрифтов;
 * - блокирует загрузку медиа-файлов;
 * - блокирует WebSocket-соединения;
 * - блокирует аналитические и рекламные сервисы
 *   (Google Analytics, GTM, Facebook Pixel, Hotjar, Clarity и др.).
 *
 * Используется для:
 * - ускорения загрузки страниц;
 * - снижения потребления RAM и CPU;
 * - уменьшения сетевого трафика;
 * - повышения стабильности работы Playwright;
 * - уменьшения влияния сторонних скриптов аналитики и рекламы.
 *
 * Важно:
 * Метод рекомендуется вызывать сразу после создания страницы
 * и до выполнения page.goto().
 *
 * @param ctx Контекст выполнения.
 */
async function optimizePageResources(ctx) {
    console.log('⚡ [SYS] Optimizing page resources');
    // отключаем анимации и transition
    await ctx.page.addStyleTag({
        content: `
      *,
      *::before,
      *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,
    });
    // блокировка тяжёлых ресурсов
    await ctx.page.route('**/*', async (route) => {
        const resourceType = route.request().resourceType();
        if (resourceType === 'image' ||
            resourceType === 'font' ||
            resourceType === 'media' ||
            resourceType === 'websocket') {
            await route.abort();
            return;
        }
        await route.continue();
    });
    // блокировка аналитики и рекламы
    await ctx.page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.includes('google-analytics') ||
            url.includes('googletagmanager') ||
            url.includes('facebook.net') ||
            url.includes('fbevents') ||
            url.includes('doubleclick.net') ||
            url.includes('googlesyndication.com') ||
            url.includes('googleadservices.com') ||
            url.includes('hotjar') ||
            url.includes('clarity')) {
            await route.abort();
            return;
        }
        await route.continue();
    });
    console.log('✅ [SYS] Page optimization enabled');
}
