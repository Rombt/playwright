import { IDirectoryProcessOptions } from './types/IDirectoryProcessOptions';
import { IImageConvertOptions } from './types/IImageConvertOptions';
import { IImageProcessResult } from './types/IImageProcessResult';

export interface IImageProcessor {
  /**
   * Convert image buffer to JPG buffer.
   * Used in download pipelines before saving to storage.
   */
  convertBufferToJpg(buffer: Buffer, options?: IImageConvertOptions): Promise<Buffer>;

  /**
   * Convert image file to JPG.
   * Returns resulting file path.
   */
  convertFileToJpg(
    inputPath: string,
    outputPath?: string,
    options?: IImageConvertOptions,
  ): Promise<string>;

  /**
   * Batch process images inside directory.
   * Used for user-triggered processing of existing downloads.
   */
  processDirectory(
    directory: string,
    options?: IDirectoryProcessOptions,
  ): Promise<IImageProcessResult>;
}
