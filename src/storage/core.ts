import { IrisStorageSchema, DEFAULT_SETTINGS } from "./types";

const STORAGE_KEY = "IRIS_SYSTEM_DATA";

export class IrisStorageCore {
  private data: IrisStorageSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): IrisStorageSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.getDefaults();
      
      const parsed = JSON.parse(raw);
      // Rehydrate Float32Arrays for descriptors
      if (parsed.faces) {
        parsed.faces = parsed.faces.map((f: any) => ({
          ...f,
          descriptor: new Float32Array(Object.values(f.descriptor)),
        }));
      }
      return { ...this.getDefaults(), ...parsed };
    } catch (e) {
      console.error("IRIS STORAGE CORRUPTION DETECTED", e);
      return this.getDefaults();
    }
  }

  private getDefaults(): IrisStorageSchema {
    return {
      faces: [],
      settings: DEFAULT_SETTINGS,
      logs: [],
    };
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error("IRIS STORAGE SAVE FAILED", e);
    }
  }

  public get<K extends keyof IrisStorageSchema>(key: K): IrisStorageSchema[K] {
    return this.data[key];
  }

  public set<K extends keyof IrisStorageSchema>(key: K, value: IrisStorageSchema[K]): void {
    this.data[key] = value;
    this.save();
  }

  public update<K extends keyof IrisStorageSchema>(key: K, updater: (prev: IrisStorageSchema[K]) => IrisStorageSchema[K]): void {
    this.data[key] = updater(this.data[key]);
    this.save();
  }
}
