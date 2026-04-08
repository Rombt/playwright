"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FingerprintPool = void 0;
const fs = require("fs");
const path = require("path");
const appConfig_1 = require("../../data/config/appConfig");
class FingerprintPool {
    available;
    active = new Set();
    config;
    constructor() {
        this.config = appConfig_1.AppConfig.getInstance();
        if (!this.config.fingerprintFile) {
            throw new Error('fingerprintFile is required');
        }
        const profilesFile = this.config.fingerprintFile;
        const fullPath = path.resolve(profilesFile);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Файл профилей не найден: ${fullPath}`);
        }
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const profiles = JSON.parse(raw);
        if (profiles.length === 0)
            throw new Error('Пул профилей пустой');
        this.available = [...profiles];
        this.active = new Set();
    }
    get() {
        const free = this.available.filter((p) => !this.active.has(p));
        if (free.length === 0)
            return null; // все заняты
        const profile = free[Math.floor(Math.random() * free.length)];
        this.active.add(profile);
        return profile;
    }
    release(profile) {
        this.active.delete(profile);
    }
}
exports.FingerprintPool = FingerprintPool;
