import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import actionRoutes from "./backend/actionRoutes";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Routes
  app.use("/api", actionRoutes);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", system: "IRIS" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving (if needed in future)
    // app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
