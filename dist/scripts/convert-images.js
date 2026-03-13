"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs/promises");
const path = require("path");
const SharpImageProcessor_1 = require("../services/ImageProcessor/SharpImageProcessor");
const FileStorage_1 = require("../storage/fs/FileStorage");
// запуск npm run  img-convert  -- "abs/path/to/folder/images"
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
