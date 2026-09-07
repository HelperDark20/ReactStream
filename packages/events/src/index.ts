/**
 * @reactstream/events — Contratos de eventos (Sección 5 y 6 del documento maestro).
 *
 * DECISIÓN DE DISEÑO (Etapa 1): la Sección 5 ilustra el envelope con un campo
 * `payload` genérico, pero la Sección 6 (contratos TS normativos) define
 * `BaseEvent` SIN ese campo — cada evento concreto aplana sus propios campos
 * directamente sobre el envelope. Estos contratos siguen la Sección 6 por ser
 * la más específica. Regla #14: los eventos normalizados son contratos
 * estables — cualquier cambio aquí requiere Regla #75 (pruebas + docs).
 */

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Gift {
  id: string;
  name: string;
  /** Valor de UNA unidad del regalo (Regla #28). NUNCA totalCoins. */
  coins: number;
  imageUrl?: string;
  region: string;
}

export type EventSource = "tiktok" | "simulation" | "system";

export type EventType =
  | "live_started"
  | "live_ended"
  | "gift"
  | "like"
  | "follow"
  | "comment"
  | "share"
  | "member"
  | "viewer_count"
  | "timer_zero";

/**
 * Envelope común a todos los eventos.
 * Regla #15: cada evento tiene ID único. Regla #16: duplicados se ignoran.
 * Regla #17-18: sessionId separa sesiones; eventos de sesión vieja se ignoran.
 */
export interface BaseEvent {
  id: string;
  type: EventType;
  /** Epoch ms, siempre UTC. */
  timestamp: number;
  sessionId: string;
  source: EventSource;
  user?: User;
  metadata?: Record<string, unknown>;
}

export interface GiftEvent extends BaseEvent {
  type: "gift";
  user: User;
  gift: Gift;
  quantity: number;
  /** = gift.coins * quantity (Regla #29). Rankings usan este campo (Regla #30). */
  totalCoins: number;
  repeatEnd: boolean;
}

export interface LikeEvent extends BaseEvent {
  type: "like";
  user: User;
  /** TikTok puede agrupar likes: NO asumir 1 evento = 1 like. */
  count: number;
}

export interface CommentEvent extends BaseEvent {
  type: "comment";
  user: User;
  text: string;
}

export interface FollowEvent extends BaseEvent {
  type: "follow";
  user: User;
}

export interface ShareEvent extends BaseEvent {
  type: "share";
  user: User;
}

export interface MemberEvent extends BaseEvent {
  type: "member";
  user: User;
}

export interface LiveStartedEvent extends BaseEvent {
  type: "live_started";
}

export interface LiveEndedEvent extends BaseEvent {
  type: "live_ended";
}

export interface TimerZeroEvent extends BaseEvent {
  type: "timer_zero";
}

export interface ViewerCountEvent extends BaseEvent {
  type: "viewer_count";
  count: number;
}

/** Unión discriminada por `type` — Event Bus y Automation Engine trabajan sobre esto. */
export type AppEvent =
  | GiftEvent
  | LikeEvent
  | CommentEvent
  | FollowEvent
  | ShareEvent
  | MemberEvent
  | LiveStartedEvent
  | LiveEndedEvent
  | TimerZeroEvent
  | ViewerCountEvent;

// --- Type guards (evitan `as` inseguro en Automation/Action Engine) ---

export function isGiftEvent(e: AppEvent): e is GiftEvent {
  return e.type === "gift";
}
export function isLikeEvent(e: AppEvent): e is LikeEvent {
  return e.type === "like";
}
export function isCommentEvent(e: AppEvent): e is CommentEvent {
  return e.type === "comment";
}
export function isFollowEvent(e: AppEvent): e is FollowEvent {
  return e.type === "follow";
}
export function isShareEvent(e: AppEvent): e is ShareEvent {
  return e.type === "share";
}
export function isMemberEvent(e: AppEvent): e is MemberEvent {
  return e.type === "member";
}
export function isLiveStartedEvent(e: AppEvent): e is LiveStartedEvent {
  return e.type === "live_started";
}
export function isLiveEndedEvent(e: AppEvent): e is LiveEndedEvent {
  return e.type === "live_ended";
}
export function isTimerZeroEvent(e: AppEvent): e is TimerZeroEvent {
  return e.type === "timer_zero";
}
export function isViewerCountEvent(e: AppEvent): e is ViewerCountEvent {
  return e.type === "viewer_count";
}
