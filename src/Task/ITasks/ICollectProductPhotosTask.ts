import { ITask } from "../ITask";

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

      products: Array<{
        /** Идентификатор товара из базы данных сайта*/
        id_product: string;

        name_product: string;

        /** SKU товара из базы данных производителя*/
        sku: string;

        attributes: {
          color: string;
          size: string;
        };
      }>;
    }
  >;
}
