/**
 * WebSocket client hacia el Core (Etapa 23).
 * Regla #55-56: comunicación solo por localhost (127.0.0.1), nunca expuesto
 * a Internet. Regla #5: el Bridge no contiene lógica de negocio — solo
 * serializa y envía los AppEvents que recibe del Normalizer.
 */

import { WebSocket } from "ws";
import type { AppEvent } from "@reactstream/events";

const RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_ATTEMPTS = 20;
const PING_INTERVAL_MS = 15_000;

export class CoreWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private pingTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private queue: AppEvent[] = [];

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.stopped) return;
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log(`[bridge:ws] conectado a Core en ${this.url}`);
      this.reconnectAttempts = 0;
      // Identificarse ante el Core (protocolo interno ReactStream)
      this.ws?.send(JSON.stringify({ clientType: "bridge" }));
      this.startPing();
      // Drenar cola acumulada durante la reconexión
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        if (event) this.sendRaw(event);
      }
    });

    this.ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { messageType?: string };
        if (msg.messageType === "pong") return; // respuesta de heartbeat
      } catch {}
    });

    this.ws.on("close", () => {
      this.stopPing();
      if (!this.stopped) this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error(`[bridge:ws] error: ${err.message}`);
      this.ws?.close();
    });
  }

  send(event: AppEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRaw(event);
    } else {
      // Acumular en cola mientras el WebSocket no esté listo
      this.queue.push(event);
    }
  }

  stop(): void {
    this.stopped = true;
    this.stopPing();
    this.ws?.close();
  }

  private sendRaw(event: AppEvent): void {
    const message = JSON.stringify({
      protocolVersion: 1,
      messageId: crypto.randomUUID(),
      messageType: "event",
      timestamp: Date.now(),
      payload: event,
    });
    this.ws?.send(message);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ messageType: "ping", timestamp: Date.now() }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[bridge:ws] máximo de intentos de reconexión alcanzado");
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY_MS * this.reconnectAttempts, 30_000);
    console.log(`[bridge:ws] reconectando en ${delay}ms (intento ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }
}
