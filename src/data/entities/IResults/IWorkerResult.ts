import { IWorkerError } from '../IErrors/IWorkerError';
import { IDataImag } from '../IDataImag';

export interface IWorkerResult {
  data: {
    images?: IDataImag;
    html?: string;
  };
  errors: IWorkerError[];
}
