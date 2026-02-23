import { google } from "googleapis";
import fs from "fs";
import path from "path";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const FOLDER_NAME = "IRIS_DATA_SANDBOX";

export class DriveService {
  private authClient: any;
  private drive: any;
  private rootFolderId: string | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const credentialsPath = process.env.SERVICE_ACCOUNT_JSON;
      if (!credentialsPath) {
        console.warn("SERVICE_ACCOUNT_JSON not set. Drive features disabled.");
        return;
      }

      let credentials;
      if (fs.existsSync(credentialsPath)) {
        credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
      } else {
        try {
          credentials = JSON.parse(credentialsPath);
        } catch (e) {
          console.error("Invalid SERVICE_ACCOUNT_JSON format");
          return;
        }
      }

      this.authClient = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
      });

      this.drive = google.drive({ version: "v3", auth: this.authClient });
      await this.ensureRootFolder();
    } catch (error) {
      console.error("Drive initialization failed:", error);
    }
  }

  private async ensureRootFolder() {
    if (!this.drive) return;

    try {
      const res = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
        fields: "files(id, name)",
      });

      if (res.data.files && res.data.files.length > 0) {
        this.rootFolderId = res.data.files[0].id;
      } else {
        const folderMetadata = {
          name: FOLDER_NAME,
          mimeType: "application/vnd.google-apps.folder",
        };
        const file = await this.drive.files.create({
          resource: folderMetadata,
          fields: "id",
        });
        this.rootFolderId = file.data.id;
      }
      console.log(`Drive Root Folder ID: ${this.rootFolderId}`);
    } catch (error) {
      console.error("Error ensuring root folder:", error);
    }
  }

  public async listFiles() {
    if (!this.drive || !this.rootFolderId) return [];
    try {
      const res = await this.drive.files.list({
        q: `'${this.rootFolderId}' in parents and trashed=false`,
        fields: "files(id, name, mimeType, webViewLink)",
      });
      return res.data.files;
    } catch (error) {
      console.error("List files error:", error);
      throw error;
    }
  }

  public async createFile(name: string, content: string, mimeType = "text/plain") {
    if (!this.drive || !this.rootFolderId) throw new Error("Drive not initialized");

    try {
      const fileMetadata = {
        name,
        parents: [this.rootFolderId],
      };
      const media = {
        mimeType,
        body: content,
      };
      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id, name, webViewLink",
      });
      return file.data;
    } catch (error) {
      console.error("Create file error:", error);
      throw error;
    }
  }

  public async createFolder(name: string) {
    if (!this.drive || !this.rootFolderId) throw new Error("Drive not initialized");
    
    try {
      const fileMetadata = {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [this.rootFolderId],
      };
      const file = await this.drive.files.create({
        resource: fileMetadata,
        fields: "id, name",
      });
      return file.data;
    } catch (error) {
      console.error("Create folder error:", error);
      throw error;
    }
  }
}

export const driveService = new DriveService();
