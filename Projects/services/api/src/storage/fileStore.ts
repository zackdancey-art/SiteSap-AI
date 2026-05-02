import fs from "fs/promises";
import path from "path";

/**
 * Handles file-backed in-memory persistence used by authStore and projectsStore.
 * Serializes concurrent writes via a promise queue and deduplicates concurrent loads.
 */
export class FileBackedStore<T> {
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private readonly label: string;

  constructor(
    private readonly filePath: string,
    private readonly onLoad: (parsed: T) => void,
    private readonly getData: () => T
  ) {
    this.label = path.basename(filePath, ".json");
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const raw = await fs.readFile(this.filePath, "utf8");
          this.onLoad(JSON.parse(raw) as T);
        } catch (error) {
          const code =
            typeof error === "object" && error !== null && "code" in error
              ? String((error as { code?: string }).code)
              : "";
          if (code !== "ENOENT") {
            console.warn(`[${this.label}] Failed to read fallback store; starting empty.`, error);
          }
        }
        this.loaded = true;
      })().finally(() => {
        this.loadPromise = null;
      });
    }
    await this.loadPromise;
  }

  async persist(): Promise<void> {
    await this.ensureLoaded();
    this.persistQueue = this.persistQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.getData(), null, 2), "utf8");
    });
    await this.persistQueue;
  }

  resetForTests(): void {
    this.loaded = true;
    this.loadPromise = null;
    this.persistQueue = Promise.resolve();
  }
}
