/**
 * Event Normalizer (Etapa 22). Único lugar del Bridge que conoce el formato
 * raw de tiktok-live-connector y lo convierte a AppEvent estable.
 * Regla #13: TikTok NO define los contratos internos.
 * Regla #14: los eventos normalizados son contratos estables.
 */

import type {
  RawCommentData,
  RawFollowData,
  RawGiftData,
  RawLikeData,
  RawMemberData,
  RawShareData,
  RawViewerCountData,
} from "../types/index.js";
import type { AppEvent } from "@reactstream/events";
import { randomUUID } from "node:crypto";

export function normalizeGift(raw: RawGiftData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "gift",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    user: {
      id: raw.userId,
      username: raw.uniqueId,
      displayName: raw.nickname,
      avatarUrl: raw.profilePictureUrl,
    },
    gift: {
      id: raw.giftId,
      name: raw.giftName,
      // diamondCount = valor de UNA unidad (Regla #28)
      coins: raw.diamondCount,
      region: "CO",
    },
    quantity: raw.repeatCount,
    // totalCoins = coins × quantity (Regla #29)
    totalCoins: raw.diamondCount * raw.repeatCount,
    repeatEnd: raw.repeatEnd,
  };
}

export function normalizeLike(raw: RawLikeData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "like",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    user: {
      id: raw.userId,
      username: raw.uniqueId,
      displayName: raw.nickname,
      avatarUrl: raw.profilePictureUrl,
    },
    // likeCount = likes agrupados en este evento (NO asumir 1 evento = 1 like)
    count: raw.likeCount,
  };
}

export function normalizeComment(raw: RawCommentData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "comment",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    user: {
      id: raw.userId,
      username: raw.uniqueId,
      displayName: raw.nickname,
      avatarUrl: raw.profilePictureUrl,
    },
    text: raw.comment,
  };
}

export function normalizeFollow(raw: RawFollowData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "follow",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    user: {
      id: raw.userId,
      username: raw.uniqueId,
      displayName: raw.nickname,
      avatarUrl: raw.profilePictureUrl,
    },
  };
}

export function normalizeShare(raw: RawShareData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "share",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    user: {
      id: raw.userId,
      username: raw.uniqueId,
      displayName: raw.nickname,
      avatarUrl: raw.profilePictureUrl,
    },
  };
}

export function normalizeMember(raw: RawMemberData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "member",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    user: {
      id: raw.userId,
      username: raw.uniqueId,
      displayName: raw.nickname,
      avatarUrl: raw.profilePictureUrl,
    },
  };
}

export function normalizeViewerCount(raw: RawViewerCountData, sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "viewer_count",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
    count: raw.viewerCount,
  };
}

export function normalizeLiveStarted(sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "live_started",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
  };
}

export function normalizeLiveEnded(sessionId: string): AppEvent {
  return {
    id: randomUUID(),
    type: "live_ended",
    timestamp: Date.now(),
    sessionId,
    source: "tiktok",
  };
}
