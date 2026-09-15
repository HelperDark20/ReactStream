/**
 * TikTok Connector (Etapa 24). Único componente que importa
 * tiktok-live-connector. Regla #4: TikTok solamente es conocido por el
 * Bridge. Regla #5-13: no contiene lógica de negocio.
 *
 * Nota: tiktok-live-connector usa un import dinámico porque es un paquete
 * CommonJS y el Bridge es ESM. El `await import()` garantiza que funciona
 * correctamente con Node.js SEA (Etapa 23 del plan original).
 */

import { randomUUID } from "node:crypto";
import {
  normalizeComment,
  normalizeFollow,
  normalizeGift,
  normalizeLike,
  normalizeLiveEnded,
  normalizeLiveStarted,
  normalizeMember,
  normalizeShare,
  normalizeViewerCount,
} from "../normalizer/index.js";
import { CoreWebSocketClient } from "../websocket/index.js";
import type { BridgeConfig, BridgeStatus } from "../types/index.js";

export class TikTokConnector {
  private client: CoreWebSocketClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tiktokClient: any = null;
  private sessionId: string = "";
  private status: BridgeStatus = "stopped";
  private config: BridgeConfig;

  constructor(config: BridgeConfig) {
    this.config = config;
    this.client = new CoreWebSocketClient(config.coreWsUrl);
  }

  getStatus(): BridgeStatus {
    return this.status;
  }

  async start(): Promise<void> {
    this.status = "connecting";
    this.client.connect();
    await this.connectToTikTok();
  }

  stop(): void {
    this.status = "stopped";
    this.client.stop();
    try {
      
      this.tiktokClient?.disconnect?.();
    } catch {}
  }

  private async connectToTikTok(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("tiktok-live-connector") as any;
      const { WebcastPushConnection } = mod;
      
      this.tiktokClient = new WebcastPushConnection(this.config.tiktokUsername, {
        enableExtendedGiftInfo: true,
        requestPollingIntervalMs: 2000,
      });

      this.sessionId = randomUUID();
      this.wireEvents();

      
      await this.tiktokClient.connect();
      this.status = "connected";

      this.client.send(normalizeLiveStarted(this.sessionId));
      console.log(`[bridge:connector] conectado al LIVE de @${this.config.tiktokUsername}`);
    } catch (err) {
      this.status = "error";
      console.error("[bridge:connector] error al conectar con TikTok:", err);
      this.scheduleReconnect();
    }
  }

  private wireEvents(): void {
    const c = this.tiktokClient as {
      on: (event: string, handler: (data: unknown) => void) => void;
    };

    c.on("gift", (data) => {
      // Solo procesar cuando repeatEnd=true para evitar eventos parciales
      // de combos (tiktok-live-connector envía múltiples gifts intermedios)
      const raw = data as {
        repeatEnd: boolean;
        giftId: string;
        giftName: string;
        diamondCount: number;
        repeatCount: number;
        userId: string;
        uniqueId: string;
        nickname: string;
        profilePictureUrl?: string;
      };
      if (!raw.repeatEnd) return;
      this.client.send(normalizeGift(raw, this.sessionId));
    });

    c.on("like", (data) => {
      this.client.send(normalizeLike(data as Parameters<typeof normalizeLike>[0], this.sessionId));
    });

    c.on("chat", (data) => {
      this.client.send(
        normalizeComment(data as Parameters<typeof normalizeComment>[0], this.sessionId)
      );
    });

    c.on("follow", (data) => {
      this.client.send(
        normalizeFollow(data as Parameters<typeof normalizeFollow>[0], this.sessionId)
      );
    });

    c.on("share", (data) => {
      this.client.send(
        normalizeShare(data as Parameters<typeof normalizeShare>[0], this.sessionId)
      );
    });

    c.on("member", (data) => {
      this.client.send(
        normalizeMember(data as Parameters<typeof normalizeMember>[0], this.sessionId)
      );
    });

    c.on("roomUser", (data) => {
      this.client.send(
        normalizeViewerCount(
          data as Parameters<typeof normalizeViewerCount>[0],
          this.sessionId
        )
      );
    });

    c.on("streamEnd", () => {
      this.client.send(normalizeLiveEnded(this.sessionId));
      this.status = "stopped";
    });

    c.on("disconnected", () => {
      // Regla #19: desconexión de TikTok NO significa LIVE terminado —
      // NO enviamos live_ended aquí, solo intentamos reconectar.
      this.status = "reconnecting";
      console.log("[bridge:connector] desconectado de TikTok, reconectando...");
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      if (this.status !== "stopped") {
        this.connectToTikTok().catch(console.error);
      }
    }, this.config.reconnectDelayMs);
  }
}
