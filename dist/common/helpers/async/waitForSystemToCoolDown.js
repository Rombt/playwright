"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForSystemToCoolDown = waitForSystemToCoolDown;
/**
 * Ожидает, пока системные ресурсы (оперативная память и CPU)
 * не опустятся до допустимого уровня перед продолжением выполнения
 * автоматизации Playwright.
 *
 * Функция используется для защиты от запуска тяжёлых операций
 * в момент высокой нагрузки на систему, что может приводить к:
 * - замедлению кликов
 * - нестабильному выполнению сценариев
 * - задержкам рендера страниц
 *
 * Проверяет состояние системы по двум основным метрикам:
 *
 * 1. Свободная оперативная память (RAM)
 *    - сравнивается с параметром `minFreeMemMB`
 *
 * 2. Загрузка процессора (CPU)
 *    - сравнивается с параметром `maxCpuLoad`
 *
 * Функция работает в цикле:
 * - выполняет проверку ресурсов
 * - если условия не выполнены, ждёт `checkIntervalMs`
 * - повторяет проверку до достижения стабильного состояния
 *
 * Если в течение времени `timeoutMs` система не стабилизируется,
 * выполнение прерывается с ошибкой.
 *
 * ⚠️ Важно:
 * - функция работает только с уровнем ОС (CPU/RAM)
 * - НЕ проверяет готовность страницы, DOM или JavaScript
 * - НЕ гарантирует, что сайт готов к кликам
 *
 * @param ctx - Контекст выполнения Playwright, содержащий страницу (page)
 *
 * @param options.minFreeMemMB - Минимальное количество свободной RAM (в MB),
 * при котором система считается загруженной недостаточно.
 * По умолчанию: 500 MB.
 *
 * @param options.maxCpuLoad - Максимально допустимая загрузка CPU (0.0 - 1.0).
 * Например:
 * - 0.5 = 50% загрузки
 * - 0.85 = 85% загрузки
 * По умолчанию: 0.85.
 *
 * @param options.checkIntervalMs - Интервал между проверками состояния системы (мс).
 * По умолчанию: 3000 (3 секунды).
 *
 * @param options.timeoutMs - Максимальное время ожидания стабилизации системы (мс).
 * По умолчанию: 60000 (60 секунд).
 *
 * @returns Promise<void> - Завершается, когда система считается стабильной
 *
 * @throws Error - выбрасывается, если система не стабилизировалась
 * в течение времени `timeoutMs`
 */
async function waitForSystemToCoolDown(ctx, options) {
    const { minFreeMemMB = 500, maxCpuLoad = 0.85, checkIntervalMs = 3000, timeoutMs = 60_000, } = options || {};
    // INIT LOG
    await ctx.page.waitForFunction(({ minFreeMemMB, maxCpuLoad, checkIntervalMs, timeoutMs }) => {
        console.log('🚀 [SYS] INIT');
        console.log('⚙️ Config:', {
            minFreeMemMB,
            maxCpuLoad,
            checkIntervalMs,
            timeoutMs,
        });
        return true;
    }, { minFreeMemMB, maxCpuLoad, checkIntervalMs, timeoutMs });
    const startTime = Date.now();
    let iteration = 0;
    while (true) {
        iteration++;
        // ITERATION LOG
        await ctx.page.waitForFunction(({ iteration }) => {
            console.log(`\n🔁 [SYS] Iteration #${iteration}`);
            return true;
        }, { iteration });
        const freeMemMB = require('os').freemem() / 1024 / 1024;
        await ctx.page.waitForFunction(({ freeMemMB }) => {
            console.log(`💾 RAM check: ${freeMemMB.toFixed(2)} MB free`);
            return true;
        }, { freeMemMB });
        let cpuLoad = 0;
        try {
            const os = require('os');
            const cpus = os.cpus();
            let idle = 0;
            let total = 0;
            for (const cpu of cpus) {
                for (const type in cpu.times) {
                    total += cpu.times[type];
                }
                idle += cpu.times.idle;
            }
            cpuLoad = 1 - idle / total;
            await ctx.page.waitForFunction(() => {
                console.log('🔥 CPU calculated OK');
                return true;
            });
        }
        catch (err) {
            await ctx.page.waitForFunction(({ message }) => {
                console.log('❌ CPU calculation error:', message);
                return true;
            }, { message: String(err) });
        }
        await ctx.page.waitForFunction(({ cpuLoad }) => {
            console.log(`📊 CPU load: ${(cpuLoad * 100).toFixed(2)}%`);
            return true;
        }, { cpuLoad });
        const memoryOk = freeMemMB >= minFreeMemMB;
        const cpuOk = cpuLoad <= maxCpuLoad;
        await ctx.page.waitForFunction(({ memoryOk, cpuOk, freeMemMB, cpuLoad }) => {
            console.log('🧪 Conditions:', {
                memoryOk,
                cpuOk,
                freeMemMB,
                cpuLoad,
            });
            return true;
        }, { memoryOk, cpuOk, freeMemMB, cpuLoad });
        if (memoryOk && cpuOk) {
            await ctx.page.waitForFunction(() => {
                console.log('✅ [SYS] System is OK → EXIT FUNCTION');
                return true;
            });
            return;
        }
        const elapsed = Date.now() - startTime;
        await ctx.page.waitForFunction(({ elapsed }) => {
            console.log(`⏱️ Elapsed: ${(elapsed / 1000).toFixed(1)}s`);
            return true;
        }, { elapsed });
        if (elapsed > timeoutMs) {
            await ctx.page.waitForFunction(() => {
                console.log('⛔ TIMEOUT REACHED → THROW ERROR');
                return true;
            });
            throw new Error('System cooldown timeout');
        }
        await ctx.page.waitForFunction(({ checkIntervalMs }) => {
            console.log(`😴 Sleeping ${checkIntervalMs}ms...\n`);
            return true;
        }, { checkIntervalMs });
        await sleep(checkIntervalMs);
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
