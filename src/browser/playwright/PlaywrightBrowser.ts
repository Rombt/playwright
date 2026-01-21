import { Browser } from "../Browser";

// тут потом будет import { chromium, Page } from "playwright";

export class PlaywrightBrowser implements Browser {
  async open(url: string): Promise<void> {
    console.log("open", url);
  }

    async getHtml(): Promise<string> {
        console.log("getHtml()");
    return "";
  }

    async find(selector: string): Promise<boolean> {
      console.log("find(selector: string)");
    return false;
  }

    async getAttribute(selector: string, name: string): Promise<string | null> {
      console.log("getAttribute(selector: string, name: string)");
    return null;
  }

  async download(url: string, saveAs: string): Promise<void> {
    console.log("download", url, saveAs);
  }

  async close(): Promise<void> {}
}
