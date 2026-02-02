import { IWorkerError } from '../IErrors/IWorkerError';
import { IDataImag } from '../IDataImag';

export interface IWorkerResult {
  data: IDataImag;
  errors: IWorkerError[];
}
