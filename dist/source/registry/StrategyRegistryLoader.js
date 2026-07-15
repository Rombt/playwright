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
exports.StrategyRegistryLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StrategyRegistryLoader {
    strategiesFolder;
    registry = new Map();
    constructor(strategiesFolder) {
        this.strategiesFolder = strategiesFolder;
    }
    async load() {
        const files = this.getAllFiles(this.strategiesFolder);
        for (const file of files) {
            if (!file.endsWith('.ts') && !file.endsWith('.js'))
                continue;
            const module = await Promise.resolve(`${file}`).then(s => __importStar(require(s)));
            const StrategyClass = module.default;
            if (!StrategyClass)
                continue;
            const instance = new StrategyClass();
            if (!instance.name) {
                throw new Error(`Strategy missing name: ${file}`);
            }
            if (this.registry.has(instance.name)) {
                throw new Error(`Duplicate strategy name: ${instance.name}`);
            }
            this.registry.set(instance.name, instance);
        }
        return this.registry;
    }
    get(name) {
        return this.registry.get(name);
    }
    getAll() {
        return this.registry;
    }
    has(name) {
        return this.registry.has(name);
    }
    getAllFiles(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...this.getAllFiles(fullPath));
            }
            else {
                files.push(fullPath);
            }
        }
        return files;
    }
}
exports.StrategyRegistryLoader = StrategyRegistryLoader;
