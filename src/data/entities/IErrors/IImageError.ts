import { IImageItem } from '../IImageItem';
import { IWorkerError } from './IWorkerError';

export interface IImageError {
  item: IImageItem;
  error: IWorkerError;
}
