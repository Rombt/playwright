import { Locator } from 'playwright';

export type IExtractHtmlOptions = {
  containers: (string | Locator)[];
  removeSelectors?: string[];
  expand?: boolean;
  separator?: string; // разделитель между блоками
};
