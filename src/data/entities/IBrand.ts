import { IProduct } from '../entities/IProduct';

export interface IBrand {
  brand_id: string;
  brand_name: string;
  metadata: {
    target_website: string | null;
  };
  products: IProduct[];
}
