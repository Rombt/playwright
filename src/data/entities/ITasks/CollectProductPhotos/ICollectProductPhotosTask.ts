import { IProduct } from '../../IProduct';
import { ITask } from '../../ITask';

export interface ICollectProductPhotosTask extends ITask {
  brand_id: string;
  brand_name: string;
  metadata: {
    target_website: string | null;
  };
  products: IProduct[];
}
