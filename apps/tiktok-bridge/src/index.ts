/**
 * ReactStream — TikTok Bridge (Entry point)
 * Regla #4-13: solo conecta TikTok y envía eventos normalizados al Core.
 * Sin lógica de negocio, sin KeyStroke, sin audio, sin SQLite, sin licencias.
 */

import { TikTokConnector } from "./connector/index.js";

const CORE_WS_URL = process.env["REACTSTREAM_CORE_WS_URL"] ?? "ws://127.0.0.1:47821/bridge";
const TIKTOK_USERNAME = process.env["REACTSTREAM_TIKTOK_USERNAME"] ?? "";

if (!TIKTOK_USERNAME) {
  console.error("[bridge] ERROR: REACTSTREAM_TIKTOK_USERNAME no configurado");
  process.exit(1);
}

const connector = new TikTokConnector({
  tiktokUsername: TIKTOK_USERNAME,
  coreWsUrl: CORE_WS_URL,
  reconnectDelayMs: 3_000,
  maxReconnectAttempts: 20,
});

process.on("SIGINT", () => {
  console.log("[bridge] deteniendo...");
  connector.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  connector.stop();
  process.exit(0);
});

connector.start().catch((err) => {
  console.error("[bridge] error fatal:", err);
  process.exit(1);
});
