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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharpImageProcessor = void 0;
const sharp_1 = __importDefault(require("sharp"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class SharpImageProcessor {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    async convertBufferToJpg(buffer, options) {
        const quality = options?.quality ?? 85;
        return (0, sharp_1.default)(buffer)
            .flatten({ background: '#ffffff' })
            .jpeg({
            quality,
            progressive: options?.progressive ?? true,
        })
            .toBuffer();
    }
    async convertFileToJpg(inputPath, targetDir, options, logger) {
        const buffer = await fs.readFile(inputPath);
        const jpgBuffer = await this.convertBufferToJpg(buffer, options);
        const parsed = path.parse(inputPath);
        const filename = `${parsed.name}.jpg`;
        await this.storage.save({
            filename,
            buffer: jpgBuffer,
            targetDir,
            loggerScope: logger,
        });
        return filename;
    }
    async processDirectory(directory, options, logger) {
        const result = {
            processed: 0,
            skipped: 0,
            errors: 0,
        };
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            try {
                if (entry.isDirectory()) {
                    if (options?.recursive) {
                        const sub = await this.processDirectory(fullPath, options, logger);
                        result.processed += sub.processed;
                        result.skipped += sub.skipped;
                        result.errors += sub.errors;
                    }
                    continue;
                }
                const ext = path.extname(entry.name).toLowerCase();
                if (ext === '.jpg' || ext === '.jpeg') {
                    result.skipped++;
                    continue;
                }
                await this.convertFileToJpg(fullPath, directory, {
                    quality: options?.quality,
                }, logger);
                result.processed++;
            }
            catch (err) {
                result.errors++;
                logger?.error(`Image processing failed`, {
                    component: 'SharpImageProcessor',
                    method: 'processDirectory',
                    action: 'convertFileToJpg',
                    data: {
                        file: fullPath,
                        error: err instanceof Error ? err.message : String(err),
                    },
                });
            }
        }
        return result;
    }
}
exports.SharpImageProcessor = SharpImageProcessor;
