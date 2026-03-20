import { IWorkerError } from '../IErrors/IWorkerError';
import { IDataImag } from '../IDataImag';

/**
 *
 * изменить data таким образом что бы
 *    можно было добавлять в неё любое количество разнообразных типов данных
 *    не сломать существующий код
 *
  //!!!!!!!!!!!!!!!!!!!!!  остановился здесь  !!!!!!!!!!!!!!!!!!!!!!!!!!!
 * сейчас нужно в data добавить тип данных который будет содержать сырой html
 *
 *
 */

// export interface IWorkerResult {
//   data: IDataImag;
//   errors: IWorkerError[];
// }

export interface IWorkerResult {
  data: {
    images?: IDataImag;
    html?: Record<string, string>;
  };
  errors: IWorkerError[];
}
