export interface IActions {
  click(selector: string): Promise<void>;

  waitForSelector(selector: string, timeout?: number): Promise<void>;

  scroll(options?: { step?: number; delay?: number }): Promise<void>;

  waitForImages(): Promise<void>;

  getHtml(selector?: string): Promise<string>;

  getAttribute(selector: string, attr: string): Promise<string | null>;

  getText(selector: string): Promise<string | null>;

  exists(selector: string): Promise<boolean>;
}
