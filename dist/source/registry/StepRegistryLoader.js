"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepRegistryLoader = void 0;
const fs = require("fs");
const path = require("path");
class StepRegistryLoader {
    stepsPath;
    registry = new Map();
    constructor(stepsPath) {
        this.stepsPath = stepsPath;
    }
    async load() {
        const files = this.getAllFiles(this.stepsPath);
        console.log('files = ', files); //!!--!!
        for (const file of files) {
            if (!file.endsWith('.ts') && !file.endsWith('.js'))
                continue;
            const module = await Promise.resolve(`${file}`).then(s => require(s));
            console.dir(module, { depth: null, colors: true }); //!!--!!
            const StepClass = module.default;
            console.log('StepClass = '); //!!--!!
            console.dir(StepClass, { depth: null, colors: true }); //!!--!!
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
                files.push(...this.getAllFiles(fullPath)); // 🔁 рекурсия
            }
            else {
                files.push(fullPath);
            }
        }
        return files;
    }
}
exports.StepRegistryLoader = StepRegistryLoader;
