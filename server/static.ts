import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function log(message: string, source = "express", meta?: Record<string, unknown>) {
  const now = new Date();
  if (process.env.NODE_ENV === "production") {
    const payload = { ts: now.toISOString(), source, message, ...(meta || {}) };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
    return;
  }
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  // eslint-disable-next-line no-console
  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}


