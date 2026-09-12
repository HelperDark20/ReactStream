import { describe, expect, it } from "vitest";
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
} from "./index.js";

const SESSION_ID = "live_test_001";

describe("Normalizer — contratos de wire format (Reglas #13-14)", () => {
  it("normalizeGift cumple Reglas #28 y #29", () => {
    const event = normalizeGift(
      {
        giftId: "5655",
        giftName: "Rosa",
        diamondCount: 1,
        repeatCount: 10,
        repeatEnd: true,
        userId: "u1",
        uniqueId: "carlos",
        nickname: "Carlos",
      },
      SESSION_ID
    );

    expect(event.type).toBe("gift");
    expect(event.sessionId).toBe(SESSION_ID);
    expect(event.source).toBe("tiktok");
    if (event.type !== "gift") throw new Error("unreachable");
    // Regla #28: coins = valor de UNA unidad
    expect(event.gift.coins).toBe(1);
    // Regla #29: totalCoins = coins × quantity
    expect(event.totalCoins).toBe(event.gift.coins * event.quantity);
    expect(event.repeatEnd).toBe(true);
  });

  it("normalizeLike preserva likeCount agrupado", () => {
    const event = normalizeLike(
      {
        userId: "u1",
        uniqueId: "maria",
        nickname: "Maria",
        likeCount: 25,
        totalLikeCount: 100,
      },
      SESSION_ID
    );
    expect(event.type).toBe("like");
    if (event.type !== "like") throw new Error("unreachable");
    expect(event.count).toBe(25);
  });

  it("normalizeComment preserva el texto", () => {
    const event = normalizeComment(
      { userId: "u1", uniqueId: "u1", nickname: "U1", comment: "hola!" },
      SESSION_ID
    );
    expect(event.type).toBe("comment");
    if (event.type !== "comment") throw new Error("unreachable");
    expect(event.text).toBe("hola!");
  });

  it("normalizeFollow, Share, Member producen eventos con user", () => {
    const base = { userId: "u1", uniqueId: "u1", nickname: "U1" };
    const follow = normalizeFollow(base, SESSION_ID);
    const share = normalizeShare(base, SESSION_ID);
    const member = normalizeMember(base, SESSION_ID);

    expect(follow.type).toBe("follow");
    expect(share.type).toBe("share");
    expect(member.type).toBe("member");
    if (follow.type !== "follow") throw new Error("unreachable");
    expect(follow.user.id).toBe("u1");
  });

  it("normalizeViewerCount preserva el conteo", () => {
    const event = normalizeViewerCount({ viewerCount: 1500 }, SESSION_ID);
    expect(event.type).toBe("viewer_count");
    if (event.type !== "viewer_count") throw new Error("unreachable");
    expect(event.count).toBe(1500);
  });

  it("normalizeLiveStarted y LiveEnded tienen el tipo correcto", () => {
    expect(normalizeLiveStarted(SESSION_ID).type).toBe("live_started");
    expect(normalizeLiveEnded(SESSION_ID).type).toBe("live_ended");
  });

  it("todos los eventos tienen id, timestamp, sessionId y source", () => {
    const events = [
      normalizeGift(
        { giftId: "5655", giftName: "Rosa", diamondCount: 1, repeatCount: 1, repeatEnd: true, userId: "u1", uniqueId: "u1", nickname: "U1" },
        SESSION_ID
      ),
      normalizeLike({ userId: "u1", uniqueId: "u1", nickname: "U1", likeCount: 1, totalLikeCount: 1 }, SESSION_ID),
      normalizeLiveStarted(SESSION_ID),
      normalizeLiveEnded(SESSION_ID),
    ];

    for (const event of events) {
      expect(typeof event.id).toBe("string");
      expect(event.id.length).toBeGreaterThan(0);
      expect(typeof event.timestamp).toBe("number");
      expect(event.sessionId).toBe(SESSION_ID);
      expect(event.source).toBe("tiktok");
    }
  });
});
