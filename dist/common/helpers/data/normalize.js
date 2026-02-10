"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAllData = normalizeAllData;
function normalizeAllData(source) {
    const map = new Map();
    for (const [key, urls] of Object.entries(source)) {
        if (!map.has(key)) {
            map.set(key, new Set());
        }
        const set = map.get(key);
        for (const url of urls) {
            set.add(url);
        }
    }
    return Object.fromEntries([...map.entries()].map(([key, set]) => [key, [...set]]));
}
