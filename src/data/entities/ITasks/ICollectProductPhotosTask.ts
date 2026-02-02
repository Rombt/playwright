import { ITask } from '../ITask';
import { IProduct } from '../IProduct';

export interface ICollectProductPhotosTask extends ITask {
  type: 'collect_product_photos';

  generated_at: string;

  task: Record<
    string,
    {
      brand_id: string;
      brand_name: string;

      metadata: {
        target_website: string | null;
      };

      products: IProduct[];
    }
  >;
}
