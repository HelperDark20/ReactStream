// src/index.js — ReactStream License Server
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import licensesRouter from "./routes/licenses.js";
import adminRouter    from "./routes/admin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar .env manualmente (sin dotenv)
const envPath = join(__dirname, "../../.env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
  console.log("[env] .env cargado desde:", envPath);
}

const PORT = process.env.PORT ?? 3000;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  const allowed = process.env.ALLOWED_ORIGINS?.split(",") ?? ["*"];
  const origin  = req.headers.origin ?? "";
  if (allowed.includes("*") || allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", allowed.includes("*") ? "*" : origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Rutas
app.use("/api/licenses", licensesRouter);
app.use("/admin/api", adminRouter);
app.use("/admin", express.static(join(__dirname, "../public/admin")));
app.get("/admin/*", (_req, res) => {
  res.sendFile(join(__dirname, "../public/admin/index.html"));
});
app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
app.get("/", (_req, res) => res.json({
  name: "ReactStream License Server",
  version: "1.0.0",
  endpoints: ["/api/licenses/activate", "/api/licenses/validate", "/admin"],
}));

app.listen(PORT, () => {
  console.log(`[license-server] corriendo en puerto ${PORT}`);
  console.log(`[license-server] admin panel: http://localhost:${PORT}/admin`);
});