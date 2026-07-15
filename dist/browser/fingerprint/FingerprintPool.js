"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FingerprintPool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
