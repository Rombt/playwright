"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzzyMatchStrings = fuzzyMatchStrings;
const fast_fuzzy_1 = require("fast-fuzzy");
function normalize(str) {
    return str
        .toLowerCase()
        .replace(/[\/\\_-]+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]+/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function escapeRegex(str) {
    // при обнаружении новых ложных совпадений расширять regex но НЕ удаляя уже существующее!!
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Универсальный helper для нечеткого (fuzzy) сравнения двух строк.
 *
 * Как работает:
 * 1. Обе строки (`a` и `b`) предварительно нормализуются:
 *    - приводятся к нижнему регистру
 *    - удаляются спецсимволы
 *    - разделители (/ \ _ -) заменяются на пробелы
 *    - схлопываются лишние пробелы
 *
 * 2. Выполняется обязательное fuzzy-сравнение через fast-fuzzy:
 *    - возвращает score от 0 до 1
 *    - чем ближе к 1, тем строки более похожи
 *
 * 3. (Опционально) применяется SKU-буст (`skuBoost`):
 *    - если передан `sku`, проверяется его наличие в исходных строках (`a` или `b`)
 *    - используется строгая проверка: SKU не должен продолжаться цифрами
 *      (например: `404801` совпадёт с `404801L`, но не с `40480154`)
 *
 *    Если SKU найден:
 *    - к итоговому score добавляется фиксированное значение `skuBoost` (по умолчанию 0.2)
 *    - итоговый score ограничивается максимумом 1
 *
 *    Важно:
 *    - `skuBoost` НЕ является фильтром и НЕ гарантирует match
 *    - это только сигнал уверенности, который усиливает результат fuzzy-сравнения
 *    - даже при наличии SKU итоговое решение всё равно зависит от `threshold`
 *
 * 4. Итог:
 *    - `match` = score >= threshold
 *    - возвращается score и мета-информация (был ли применён SKU-буст)
 *
 * Параметры:
 * - a, b: строки для сравнения
 * - sku (опционально): дополнительный сигнал для повышения точности
 * - threshold (по умолчанию 0.7): порог совпадения
 *
 * Возвращает:
 * {
 *   match: boolean,
 *   score: number,
 *   meta: {
 *     skuMatched: boolean,
 *     skuBoost: number
 *   }
 * }
 */
function fuzzyMatchStrings({ a, b, sku, threshold = 0.7, skuUsersBoost = 0.2, }) {
    const normA = normalize(a);
    const normB = normalize(b);
    //  основной fuzzy score (ОБЯЗАТЕЛЬНО)
    let score = (0, fast_fuzzy_1.fuzzy)(normA, normB);
    let skuBoost = 0;
    let skuMatched = false;
    //  опциональный SKU
    if (sku) {
        const safeSku = escapeRegex(sku);
        const skuRegex = new RegExp(`\\b${safeSku}(?!\\d)`, 'i');
        if (skuRegex.test(a) || skuRegex.test(b)) {
            skuMatched = true;
            skuBoost = skuUsersBoost; // можно тюнить
            score = Math.min(score + skuBoost, 1);
        }
    }
    return {
        match: score >= threshold,
        score,
        meta: {
            skuMatched,
            skuBoost,
        },
    };
}
