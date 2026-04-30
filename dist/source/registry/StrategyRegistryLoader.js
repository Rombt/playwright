"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyRegistryLoader = void 0;
const fs = require("fs");
const path = require("path");
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
            const module = await Promise.resolve(`${file}`).then(s => require(s));
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
