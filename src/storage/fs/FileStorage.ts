import { Storage } from "../Storage";
import { ImageResult } from "../../contracts/ImageResult";

export class FileStorage implements Storage {
  async save(results: ImageResult[]): Promise<void> {
    console.log("Saving", results.length, "images");
  }
}