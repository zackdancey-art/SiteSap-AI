import fs from "fs/promises";
import path from "path";

type SaveParams = { id: string; filename: string; buffer: Buffer };

export class LocalStorageAdapter {
  base: string;
  constructor(baseDir?: string) {
    this.base = baseDir || path.join(process.cwd(), "storage");
  }

  async ensureDir() {
    await fs.mkdir(this.base, { recursive: true });
  }

  async saveFile({ id, filename, buffer }: SaveParams) {
    await this.ensureDir();
    const filepath = path.join(this.base, `${id}-${filename}`);
    await fs.writeFile(filepath, buffer);
    return { id, filename, filepath, url: `local://${filepath}` };
  }

  getFilePath(id: string, filename: string) {
    return path.join(this.base, `${id}-${filename}`);
  }

  async readFile(filepath: string) {
    return fs.readFile(filepath);
  }
}
