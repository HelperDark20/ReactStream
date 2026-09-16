/**
 * TikTok Connector (Etapa 24). Único componente que importa
 * tiktok-live-connector. Regla #4: TikTok solamente es conocido por el
 * Bridge. Regla #5-13: no contiene lógica de negocio.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const state = await this.tiktokClient.connect();
      this.status = "connected";

      // Capturar catálogo de regalos disponibles al conectarse
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gifts: any[] = state?.availableGifts
        ?? this.tiktokClient.availableGifts
        ?? [];

      if (gifts.length > 0) {
        console.log(`[bridge:connector] ${gifts.length} regalos — sincronizando catálogo...`);
        this.client.send({
          id: randomUUID(),
          type: "gift_catalog_sync",
          timestamp: Date.now(),
          sessionId: this.sessionId,
          source: "tiktok",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gifts: gifts.map((g: any) => ({
            id: String(g.id),
            name: g.name ?? g.describe ?? "Regalo",
            coins: g.diamond_count ?? g.diamondCount ?? 0,
            imageUrl: g.image?.url_list?.[0] ?? g.image?.uri ?? null,
            region: "CO",
          })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }

      this.client.send(normalizeLiveStarted(this.sessionId));
      console.log(`[bridge:connector] conectado a @${this.config.tiktokUsername}`);
    } catch (err) {
      this.status = "error";
      console.error("[bridge:connector] error al conectar con TikTok:", err);
      this.scheduleReconnect();
    }
  }

  private wireEvents(): void {
    const c = this.tiktokClient;

    c.on("gift", (data: any) => {
      if (!data.repeatEnd) return;
      this.client.send(normalizeGift({
        giftId: String(data.gift?.id ?? data.giftId ?? "0"),
        giftName: data.gift?.name ?? data.giftName ?? "Regalo",
        diamondCount: data.gift?.diamond_count ?? data.diamondCount ?? 0,
        repeatCount: data.repeatCount ?? 1,
        repeatEnd: data.repeatEnd ?? true,
        userId: data.user?.uniqueId ?? data.userId ?? "unknown",
        uniqueId: data.user?.uniqueId ?? data.uniqueId ?? "unknown",
        nickname: data.user?.nickname ?? data.nickname ?? "Usuario",
        profilePictureUrl: data.user?.profilePictureUrl ?? data.profilePictureUrl,
      }, this.sessionId));
    });

    c.on("like", (data: any) => {
      this.client.send(normalizeLike({
        userId: data.user?.uniqueId ?? data.userId ?? "unknown",
        uniqueId: data.user?.uniqueId ?? data.uniqueId ?? "unknown",
        nickname: data.user?.nickname ?? data.nickname ?? "Usuario",
        profilePictureUrl: data.user?.profilePictureUrl,
        likeCount: data.likeCount ?? 1,
        totalLikeCount: data.totalLikeCount ?? 1,
      }, this.sessionId));
    });

    c.on("chat", (data: any) => {
      this.client.send(normalizeComment({
        userId: data.user?.uniqueId ?? data.userId ?? "unknown",
        uniqueId: data.user?.uniqueId ?? data.uniqueId ?? "unknown",
        nickname: data.user?.nickname ?? data.nickname ?? "Usuario",
        profilePictureUrl: data.user?.profilePictureUrl,
        comment: data.comment ?? data.message ?? "",
      }, this.sessionId));
    });

    c.on("follow", (data: any) => {
      this.client.send(normalizeFollow({
        userId: data.user?.uniqueId ?? data.userId ?? "unknown",
        uniqueId: data.user?.uniqueId ?? data.uniqueId ?? "unknown",
        nickname: data.user?.nickname ?? data.nickname ?? "Usuario",
        profilePictureUrl: data.user?.profilePictureUrl,
      }, this.sessionId));
    });

    c.on("share", (data: any) => {
      this.client.send(normalizeShare({
        userId: data.user?.uniqueId ?? data.userId ?? "unknown",
        uniqueId: data.user?.uniqueId ?? data.uniqueId ?? "unknown",
        nickname: data.user?.nickname ?? data.nickname ?? "Usuario",
        profilePictureUrl: data.user?.profilePictureUrl,
      }, this.sessionId));
    });

    c.on("member", (data: any) => {
      this.client.send(normalizeMember({
        userId: data.user?.uniqueId ?? data.userId ?? "unknown",
        uniqueId: data.user?.uniqueId ?? data.uniqueId ?? "unknown",
        nickname: data.user?.nickname ?? data.nickname ?? "Usuario",
        profilePictureUrl: data.user?.profilePictureUrl,
      }, this.sessionId));
    });

    c.on("roomUser", (data: any) => {
      this.client.send(normalizeViewerCount({
        viewerCount: data.viewerCount ?? 0,
      }, this.sessionId));
    });

    c.on("streamEnd", () => {
      this.client.send(normalizeLiveEnded(this.sessionId));
      this.status = "stopped";
    });

    c.on("disconnected", () => {
      // Regla #19: desconexión de TikTok NO significa LIVE terminado
      this.status = "reconnecting";
      console.log("[bridge:connector] desconectado, reconectando...");
      this.scheduleReconnect();
    });

    c.on("error", (err: any) => {
      console.error("[bridge:connector] error:", err?.message ?? err);
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