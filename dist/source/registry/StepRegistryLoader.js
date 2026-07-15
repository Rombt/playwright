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
exports.StepRegistryLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StepRegistryLoader {
    stepsPath;
    registry = new Map();
    constructor(stepsPath) {
        this.stepsPath = stepsPath;
    }
    async load() {
        const files = this.getAllFiles(this.stepsPath);
        for (const file of files) {
            if (!file.endsWith('.ts') && !file.endsWith('.js'))
                continue;
            const module = await Promise.resolve(`${file}`).then(s => __importStar(require(s)));
            const StepClass = module.default;
            if (!StepClass)
                continue;
            const instance = new StepClass();
            if (!instance.name) {
                throw new Error(`Step missing name: ${file}`);
            }
            this.registry.set(instance.name, StepClass);
        }
        return this.registry;
    }
    get(name) {
        const StepClass = this.registry.get(name);
        if (!StepClass) {
            throw new Error(`Step not found: ${name}`);
        }
        return StepClass;
    }
    getAll() {
        return this.registry;
    }
    has(name) {
        if (!name || typeof name !== 'string') {
            return false;
        }
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
exports.StepRegistryLoader = StepRegistryLoader;
