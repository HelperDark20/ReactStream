/**
 * @reactstream/types — Contratos transversales (Sección 6 del documento maestro).
 * Automation, Action, Execution, Session, Timer, Ranking, Best Gift, License,
 * y los protocolos Bridge↔Core / Core↔Overlays.
 */

import type { EventType, Gift, User } from "@reactstream/events";

// ============================================================
// AUTOMATION ENGINE (Sección 10)
// ============================================================

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "contains"
  | "starts_with";

export interface Condition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface ConditionGroup {
  id: string;
  logic: "AND" | "OR";
  conditions: Condition[];
  groups?: ConditionGroup[];
}

/** Triggers soportados (Sección 10) — todos menos viewer_count y evento de sesión. */
export type TriggerEventType = Extract<
  EventType,
  "gift" | "like" | "follow" | "comment" | "share" | "member" | "timer_zero"
>;

export interface Trigger {
  type: TriggerEventType;
}

export interface CooldownConfig {
  globalMs: number;
  perUserMs: number;
}

// --- Actions (Sección 11) ---

export interface BaseAction {
  id: string;
  sortOrder: number;
  repeatCount: number;
  repeatIntervalMs: number;
}

export interface KeyStrokeStep {
  keys: string[];
  durationMs?: number;
  intervalMs?: number;
}

export interface PlaySoundAction extends BaseAction {
  type: "play_sound";
  config: {
    soundId: string;
    volume?: number;
  };
}

export interface KeyStrokeAction extends BaseAction {
  type: "keystroke";
  config: {
    sequence: KeyStrokeStep[];
  };
}

export interface ShowOverlayAction extends BaseAction {
  type: "show_overlay";
  config: {
    overlayId: string;
  };
}

export interface HideOverlayAction extends BaseAction {
  type: "hide_overlay";
  config: {
    overlayId: string;
  };
}

export interface WaitAction extends BaseAction {
  type: "wait";
  config: {
    durationMs: number;
  };
}

export interface AddTimerAction extends BaseAction {
  type: "add_timer";
  config: {
    seconds: number;
  };
}

export type Action =
  | PlaySoundAction
  | KeyStrokeAction
  | ShowOverlayAction
  | HideOverlayAction
  | WaitAction
  | AddTimerAction;

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  /** Grupos combinados con AND entre sí; cada grupo tiene su propia lógica interna. */
  conditions: ConditionGroup[];
  actions: Action[];
  cooldown: CooldownConfig;
  /** 1 = más alta, 10 = normal, 100 = baja. */
  priority: number;
  createdAt: number;
  updatedAt: number;
}

export type ExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AutomationExecution {
  id: string;
  automationId: string;
  eventId: string;
  sessionId: string;
  status: ExecutionStatus;
  startedAt: number;
  finishedAt?: number;
}

// --- KeyStroke / Audio requests (Sección 12-13) ---

export interface KeyStrokeRequest {
  requestId: string;
  executionId: string;
  automationId: string;
  eventId: string;
  sessionId: string;
  priority: number;
  sequence: KeyStrokeStep[];
  repeatCount: number;
  repeatIntervalMs: number;
}

export interface AudioRequest {
  requestId: string;
  executionId: string;
  automationId: string;
  eventId: string;
  sessionId: string;
  priority: number;
  soundId: string;
  volume?: number;
  repeatCount: number;
  repeatIntervalMs: number;
}

// ============================================================
// LIVE SESSION MANAGER (Sección 8) / BEST GIFT (Sección 16)
// ============================================================

export type SessionStatus = "NO_SESSION" | "ACTIVE" | "ENDING" | "COMPLETED";

export interface BestGift {
  gift: Gift;
  sender: User;
  /** Valor unitario del regalo (gift.coins), NUNCA totalCoins del evento (Regla #31). */
  coins: number;
}

export interface LiveSession {
  id: string;
  tiktokUserId: string;
  tiktokUsername: string;
  startedAt: number;
  endedAt?: number;
  durationSeconds: number;
  status: SessionStatus;
  maxViewers: number;
  totalLikes: number;
  totalCoins: number;
  totalGifts: number;
  totalFollows: number;
  totalShares: number;
  totalComments: number;
  bestGift?: BestGift;
}

// ============================================================
// RANKING ENGINE (Sección 15)
// ============================================================

export interface DonorRankingEntry {
  user: User;
  coins: number;
}

export interface TapRankingEntry {
  user: User;
  likes: number;
}

/** 2, 3, 5, 10, 20 son los únicos valores válidos de Top N (Sección 10/20). */
export type RankingTopN = 2 | 3 | 5 | 10 | 20;

// ============================================================
// TIMER ENGINE (Sección 14)
// ============================================================

export interface TimerState {
  remainingSeconds: number;
  initialSeconds: number;
  coinsPerSecond: number;
  running: boolean;
}

/**
 * Configuración persistente del timer (Sección 21 + decisión adicional).
 * Los 3 campos se CONGELAN durante LIVE (Regla #71): cambiarlos a mitad de
 * un LIVE con el timer ya corriendo generaría inconsistencia con lo que el
 * streamer prometió a su audiencia en esa sesión.
 */
export interface TimerSettings {
  initialSeconds: number;
  coinsPerSecond: number;
  /**
   * Decisión adicional post-documento: si un regalo llega después de
   * TIMER_ZERO, ¿el timer se reactiva automáticamente (running=true)?
   * Default: true. Configurable en Settings, congelado durante LIVE.
   */
  reactivateOnZero: boolean;
}

// ============================================================
// OVERLAY ENGINE (Sección 17)
// ============================================================

export interface OverlayState {
  overlayId: string;
  visible: boolean;
  sessionId?: string;
  data: unknown;
}

export type OverlayMessageType =
  | "overlay_state"
  | "overlay_update"
  | "overlay_show"
  | "overlay_hide"
  | "overlay_reset"
  | "session_started"
  | "session_ended"
  | "timer_updated"
  | "timer_zero"
  | "ranking_updated"
  | "gift_received"
  | "likes_received"
  | "best_gift_updated"
  | "ping"
  | "pong";

export interface OverlayMessage {
  protocolVersion: number;
  messageId: string;
  messageType: OverlayMessageType;
  timestamp: number;
  sessionId?: string;
  overlayId?: string;
  payload: unknown;
}

// ============================================================
// BRIDGE ↔ CORE PROTOCOL (Sección 23)
// ============================================================

export type BridgeMessageType =
  | "event"
  | "command"
  | "response"
  | "error"
  | "ping"
  | "pong"
  | "status";

export interface BridgeMessage {
  protocolVersion: number;
  messageId: string;
  messageType: BridgeMessageType;
  timestamp: number;
  payload: unknown;
}

export type BridgeCommandName = "connect" | "disconnect" | "reconnect" | "get_status";

export interface BridgeCommandPayload {
  command: BridgeCommandName;
  /** Requerido solo para "connect". */
  username?: string;
}

export interface BridgeErrorPayload {
  requestId: string;
  code: string;
  message: string;
  recoverable: boolean;
}

// ============================================================
// LICENSING (Sección 26)
// ============================================================

export type LicensePlan = "FREE" | "PRO" | "STUDIO";

export type LicenseStatus =
  | "NOT_ACTIVATED"
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "REVOKED"
  | "DEVICE_LIMIT"
  | "OFFLINE_GRACE"
  | "INVALID";

/** Payload firmado por el servidor; el cliente solo contiene la public key. */
export interface LicensePayload {
  licenseId: string;
  deviceId: string;
  plan: LicensePlan;
  features: Record<string, boolean>;
  issuedAt: number;
  expiresAt: number;
}

// ============================================================
// ESTADOS DEL SISTEMA (Sección 28)
// ============================================================

export type ApplicationState =
  | "STARTING"
  | "READY"
  | "CONNECTING"
  | "CONNECTED"
  | "LIVE"
  | "RECONNECTING"
  | "LIVE_ENDED"
  | "DEGRADED"
  | "ERROR"
  | "SHUTTING_DOWN";

export type TikTokConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ERROR";

export type BridgeState =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "ERROR"
  | "STOPPING";

export type KeyStrokeStatus =
  | "IDLE"
  | "QUEUED"
  | "RUNNING"
  | "WAITING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type AudioStatus = "QUEUED" | "PLAYING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type TimerStatus = "STOPPED" | "RUNNING" | "ZERO";

export type OverlayConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ERROR";

export type DatabaseState = "UNINITIALIZED" | "INITIALIZING" | "READY" | "DEGRADED" | "ERROR";

export type HealthState = "HEALTHY" | "DEGRADED" | "ERROR";
