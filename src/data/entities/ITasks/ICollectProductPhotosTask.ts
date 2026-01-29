import { ITask } from "../ITask";
import { Product } from '../Product';
/**
 * Сбор фотографий товаров по SKU
 */
export interface ICollectProductPhotosTask extends ITask {
  type: "collect_product_photos";

  /** Время генерации задачи */
  generated_at: string;

  /** Основные данные задачи — набор брендов с товарами */
  task: Record<
    string,
    {
      /** Идентификатор бренда из базы данных сайта*/
      brand_id: string;

      brand_name: string;

      metadata: {
        target_website: string | null;
      };

      products: Product[];
    }
  >;
}
