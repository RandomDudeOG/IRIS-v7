export interface SavedFace {
  id: string;
  label: string; // User name
  descriptor: Float32Array; // Face descriptor from face-api.js
  createdAt: number;
  image?: string; // Base64 image
}

export interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface CloudConfig {
  enabled: boolean;
  mode: 'BACKEND' | 'SIMULATED';
  backendUrl?: string;
  serviceAccount?: ServiceAccountCreds;
  rootFolderId?: string;
}

export interface IrisSettings {
  cloudSyncEnabled: boolean;
  theme: "cyan" | "rose" | "amber";
  voiceEnabled: boolean;
  cloudConfig?: CloudConfig;
  masterKey?: string;
}

export interface IrisStorageSchema {
  faces: SavedFace[];
  settings: IrisSettings;
  logs: string[];
}

export const DEFAULT_SETTINGS: IrisSettings = {
  cloudSyncEnabled: false,
  theme: "cyan",
  voiceEnabled: true,
  cloudConfig: {
    enabled: false,
    mode: 'SIMULATED'
  }
};
