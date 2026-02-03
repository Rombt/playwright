import { ICollectProductPhotosTask } from './ICollectProductPhotosTask';

export interface ICollectProductPhotosBatch {
  type: 'collect_product_photos';

  generated_at: string;

  task: Record<string, ICollectProductPhotosTask>;
}
