/**
 * Tipos internos del TikTok Bridge (Etapa 21).
 * El Bridge SOLO conoce estos tipos — nunca los contratos internos del Core
 * directamente (Regla #4-13: Bridge no contiene lógica de negocio).
 */

export type BridgeStatus = "stopped" | "connecting" | "connected" | "reconnecting" | "error";

export interface BridgeConfig {
  tiktokUsername: string;
  coreWsUrl: string;
  reconnectDelayMs: number;
  maxReconnectAttempts: number;
  /** sessionid cookie from TikTok WebView login — bypasses signing service */
  sessionId?: string;
  /** tt-target-idc cookie from TikTok WebView login */
  ttTargetIdc?: string;
}

export interface RawGiftData {
  giftId: string;
  giftName: string;
  diamondCount: number;
  repeatCount: number;
  repeatEnd: boolean;
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
}

export interface RawLikeData {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  likeCount: number;
  totalLikeCount: number;
}

export interface RawCommentData {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  comment: string;
}

export interface RawFollowData {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
}

export interface RawShareData {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
}

export interface RawMemberData {
  userId: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
}

export interface RawViewerCountData {
  viewerCount: number;
}
