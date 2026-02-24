import { IrisStorageCore } from "./core";
import { SavedFace, IrisSettings } from "./types";
import { v4 as uuidv4 } from "uuid";

class IrisLocalStorage {
  private core: IrisStorageCore;

  constructor() {
    this.core = new IrisStorageCore();
  }

  // Face Management
  public getFaces(): SavedFace[] {
    return this.core.get("faces");
  }

  public addFace(label: string, descriptor: Float32Array, image?: string): SavedFace {
    const newFace: SavedFace = {
      id: uuidv4(),
      label,
      descriptor,
      createdAt: Date.now(),
      image,
    };
    this.core.update("faces", (faces) => [...faces, newFace]);
    return newFace;
  }

  public removeFace(id: string): void {
    this.core.update("faces", (faces) => faces.filter((f) => f.id !== id));
  }

  // Settings
  public getSettings(): IrisSettings {
    return this.core.get("settings");
  }

  public updateSettings(updates: Partial<IrisSettings>): void {
    this.core.update("settings", (s) => ({ ...s, ...updates }));
  }

  public getCloudConfig() {
    return this.getSettings().cloudConfig || { enabled: false, mode: 'SIMULATED' };
  }

  public updateCloudConfig(config: any) {
    this.updateSettings({ cloudConfig: { ...this.getCloudConfig(), ...config } });
  }

  public getMasterKey(): string {
    return this.getSettings().masterKey || "";
  }

  public saveMasterKey(key: string) {
    this.updateSettings({ masterKey: key });
  }

  public async syncWithCloud() {
      // Placeholder for sync logic triggered from Settings
      console.log("Syncing with cloud...");
  }

  // Logs
  public log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}`;
    console.log(entry);
    // Keep only last 100 logs
    this.core.update("logs", (logs) => [entry, ...logs].slice(0, 100));
  }
}

export const irisStore = new IrisLocalStorage();
