import * as path from 'path';
import { AppConfig } from '../../../data/config/appConfig';
import { ICollectProductPhotosTask } from '../../../data/entities/ITasks/CollectProductPhotos/ICollectProductPhotosTask';

/**

 */
export function buildSaveName(saveNamePattern: string, task: ICollectProductPhotosTask): string {
  return saveNamePattern.replace(/\$\{([^\}]+)\}/g, (_, key) => {
    const keys = key.split('.');
    let value: any = task;

    for (const k of keys) {
      if (value == null) return '';
      value = value[k];
    }

    return value != null ? String(value) : '';
  });
}

export function buildSaveDir(saveDirPattern: string, task: ICollectProductPhotosTask): string {
  return saveDirPattern.replace(/\$\{([^\}]+)\}/g, (_, key) => {
    const keys = key.split('.');
    let value: any = task;

    for (const k of keys) {
      if (value == null) return '';
      value = value[k];
    }

    return value != null ? String(value) : '';
  });
}
