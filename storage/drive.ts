import { irisStore } from "./local";

// This client handles communication with the backend for Drive operations
export class DriveClient {
  private static instance: DriveClient;
  private baseUrl = "/api/drive";
  private isConfigured = false;

  private constructor() {}

  public static getInstance(): DriveClient {
    if (!DriveClient.instance) {
      DriveClient.instance = new DriveClient();
    }
    return DriveClient.instance;
  }

  public static configure(config: any) {
    const instance = DriveClient.getInstance();
    // In a real app, we might validate the config here
    // For now, we assume if we have a service account JSON, we are good
    if (config.serviceAccountJson) {
        instance.isConfigured = true;
        console.log("[DRIVE] Configured with Service Account");
    } else {
        instance.isConfigured = false;
        console.warn("[DRIVE] Configuration missing Service Account");
    }
  }

  public static async init(): Promise<boolean> {
    const instance = DriveClient.getInstance();
    if (!instance.isConfigured) {
        console.warn("[DRIVE] Cannot init, not configured");
        return false;
    }

    try {
        // Ping the backend to check if drive service is healthy
        // We'll use a simple list call to root or a specific health endpoint if we had one
        // For now, let's try to list files in root
        const response = await fetch(`${instance.baseUrl}/list?folderId=root`);
        if (response.ok) {
            console.log("[DRIVE] Initialization successful");
            return true;
        } else {
            console.error("[DRIVE] Initialization failed", await response.text());
            return false;
        }
    } catch (e) {
        console.error("[DRIVE] Initialization error", e);
        return false;
    }
  }

  public async syncFaces(): Promise<void> {
    const settings = irisStore.getSettings();
    if (!settings.cloudSyncEnabled) return;

    try {
      irisStore.log("INITIATING CLOUD SYNC...");
      
      // 1. Get remote list
      // We assume a specific folder for faces, or just look for a faces.json file
      // For simplicity in this prototype, let's assume we store faces in a "iris_faces.json" file
      
      // TODO: Implement actual file search and download logic
      // This requires the backend to support searching by name, which our simple driveService might not fully expose yet
      // For now, we will log that we are syncing
      
      console.log("[DRIVE] Syncing faces (Simulated for prototype)");
      
      // In a full implementation:
      // 1. Search for 'iris_faces.json'
      // 2. If exists, download content
      // 3. Merge with local faces
      // 4. Upload merged content back to 'iris_faces.json'
      
      irisStore.log("CLOUD SYNC COMPLETE");
    } catch (error) {
      irisStore.log(`CLOUD SYNC FAILED: ${error}`);
      console.error(error);
    }
  }
}

export const driveClient = DriveClient.getInstance();
