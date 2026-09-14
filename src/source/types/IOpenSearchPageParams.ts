export type IOpenSearchPageParams = {
  strategy: string;
  waitUntil?: 'domcontentloaded' | 'load' | 'networkidle';
  clearSku?: 'full';
  nextStep?: string;
  waitForSelector?: string;
};
