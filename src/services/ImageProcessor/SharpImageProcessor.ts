import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IStorage } from '../../storage/IStorage';
import { ILogger } from '../../data/logger/types/ILogger';
import { Logger } from '../../data/logger/Logger';
import { IImageProcessor } from './IImageProcessor';
import { IDirectoryProcessOptions } from './types/IDirectoryProcessOptions';
import { IImageConvertOptions } from './types/IImageConvertOptions';
import { IImageProcessResult } from './types/IImageProcessResult';

export class SharpImageProcessor implements IImageProcessor {
  constructor(private readonly storage: IStorage) {}

  async convertBufferToJpg(buffer: Buffer, options?: IImageConvertOptions): Promise<Buffer> {
    const quality = options?.quality ?? 85;

    return sharp(buffer)
      .jpeg({
        quality,
        progressive: options?.progressive ?? true,
      })
      .toBuffer();
  }

  async convertFileToJpg(
    inputPath: string,
    targetDir: string,
    options?: IImageConvertOptions,
    logger?: ILogger,
  ): Promise<string> {
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

  async processDirectory(
    directory: string,
    options?: IDirectoryProcessOptions,
    logger?: ILogger,
  ): Promise<IImageProcessResult> {
    const result: IImageProcessResult = {
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

        await this.convertFileToJpg(
          fullPath,
          directory,
          {
            quality: options?.quality,
          },
          logger,
        );

        result.processed++;
      } catch (err) {
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
