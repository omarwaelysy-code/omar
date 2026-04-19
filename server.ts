import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import fs from "fs";
import { initDatabase } from "./src/lib/init-db";
import erpRouter from "./src/lib/erp-api";

async function startServer() {
  // Initialize PostgreSQL FIRST
  try {
    await initDatabase();
  } catch (err) {
    console.error("❌ CRITICAL: Failed to initialize PostgreSQL database. Server will start but may be degraded.");
  }
  
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // ERP API Routes
  app.use("/api/erp", erpRouter);

  // Catch-all for API routes to prevent HTML response on missing endpoints
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.send("<h1>Server is Alive</h1><script>document.body.style.backgroundColor = 'lime';</script>");
  });

  // Root test
  app.get("/", (req, res, next) => {
    if (req.query.test === 'true') {
      return res.send("<h1>Root is Alive</h1><script>document.body.style.backgroundColor = 'orange';</script>");
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
