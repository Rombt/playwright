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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const SharpImageProcessor_1 = require("../processing/ImageProcessor/SharpImageProcessor");
const FileStorage_1 = require("../storage/fs/FileStorage");
/* Функция предназначена для запуска отдельно от всего остального приложения.
  npm run  img-convert  -- "abs/path/to/folder/images"
*/
async function run() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: convert-images <directory> [--keep]');
        process.exit(1);
    }
    const directory = path.resolve(args[0]);
    const keepOriginal = args.includes('--keep');
    const storage = new FileStorage_1.FileStorage(directory);
    const imageProcessor = new SharpImageProcessor_1.SharpImageProcessor(storage);
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        const fullPath = path.join(directory, entry.name);
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') {
            skipped++;
            continue;
        }
        try {
            await imageProcessor.convertFileToJpg(fullPath, '');
            if (!keepOriginal) {
                await fs.unlink(fullPath);
            }
            processed++;
            console.log(`✔ ${entry.name}`);
        }
        catch (err) {
            errors++;
            console.error(`✖ ${entry.name}`, err);
        }
    }
    console.log('\nResult:');
    console.log(`processed: ${processed}`);
    console.log(`skipped: ${skipped}`);
    console.log(`errors: ${errors}`);
}
run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
