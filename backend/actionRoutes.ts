import express from "express";
import { driveService } from "./driveService";

const router = express.Router();

// Drive Operations
router.get("/drive/files", async (req, res) => {
  try {
    const files = await driveService.listFiles();
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/actions/create-file", async (req, res) => {
  const { name, content, mimeType } = req.body;
  try {
    const file = await driveService.createFile(name, content, mimeType);
    res.json(file);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/actions/create-folder", async (req, res) => {
  const { name } = req.body;
  try {
    const folder = await driveService.createFolder(name);
    res.json(folder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
