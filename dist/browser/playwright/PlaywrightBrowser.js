"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightBrowser = void 0;
// тут потом будет import { chromium, Page } from "playwright";
class PlaywrightBrowser {
    async open(url) {
        console.log("open", url);
    }
    async getHtml() {
        console.log("getHtml()");
        return "";
    }
    async find(selector) {
        console.log("find(selector: string)");
        return false;
    }
    async getAttribute(selector, name) {
        console.log("getAttribute(selector: string, name: string)");
        return null;
    }
    async download(url, saveAs) {
        console.log("download", url, saveAs);
    }
    async close() { }
}
exports.PlaywrightBrowser = PlaywrightBrowser;
