import { IWorkerError } from '../IErrors/IWorkerError';
import { IProduct } from '../IProduct';
import { IImageItem } from '../IImageItem';

type ProcessResult<T> =
  | { status: 'success' }
  | { status: 'retry'; entity: T; error: IWorkerError }
  | { status: 'fatal'; entity: T; error: IWorkerError };

export type TaskResult = ProcessResult<IProduct>;
export type ImageResult = ProcessResult<IImageItem>;
