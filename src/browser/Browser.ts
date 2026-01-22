export interface Browser {



  open(url: string): Promise<void>;

  getHtml(): Promise<string>;

  find(selector: string): Promise<boolean>;

  getAttribute(selector: string, name: string): Promise<string | null>;

  download(url: string, saveAs: string): Promise<void>;

  close(): Promise<void>;
}