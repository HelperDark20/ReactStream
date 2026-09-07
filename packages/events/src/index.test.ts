import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AppEvent, GiftEvent, LikeEvent, LiveStartedEvent } from "./index";
import { isGiftEvent, isLikeEvent, isLiveStartedEvent } from "./index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../../../tests/fixtures/events");

function loadFixture(name: string): AppEvent {
  const raw = readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(raw) as AppEvent;
}

describe("AppEvent contract fixtures (compartidos con Rust)", () => {
  it("gift.json cumple GiftEvent y sus reglas inmutables", () => {
    const event = loadFixture("gift.json");
    expect(isGiftEvent(event)).toBe(true);
    if (!isGiftEvent(event)) throw new Error("unreachable");

    const gift: GiftEvent = event;
    expect(gift.type).toBe("gift");
    expect(gift.sessionId).toBe("live_test_session_001");
    expect(gift.source).toBe("tiktok");
    expect(gift.user.id).toBe("123456789");
    expect(gift.gift.coins).toBe(1); // Regla #28: coins = valor de UNA unidad
    expect(gift.quantity).toBe(10);
    // Regla #29: totalCoins = gift.coins * quantity
    expect(gift.totalCoins).toBe(gift.gift.coins * gift.quantity);
    expect(typeof gift.repeatEnd).toBe("boolean");
  });

  it("like.json cumple LikeEvent (count agrupado, no 1 evento = 1 like)", () => {
    const event = loadFixture("like.json");
    expect(isLikeEvent(event)).toBe(true);
    if (!isLikeEvent(event)) throw new Error("unreachable");

    const like: LikeEvent = event;
    expect(like.type).toBe("like");
    expect(like.count).toBeGreaterThan(1);
    expect(like.user.username).toBe("maria");
  });

  it("live_started.json cumple LiveStartedEvent sin campos extra", () => {
    const event = loadFixture("live_started.json");
    expect(isLiveStartedEvent(event)).toBe(true);
    if (!isLiveStartedEvent(event)) throw new Error("unreachable");

    const liveStarted: LiveStartedEvent = event;
    expect(liveStarted.type).toBe("live_started");
    expect(liveStarted.sessionId).toBe("live_test_session_001");
    // No debe traer campos de otros tipos de evento
    expect((liveStarted as unknown as Record<string, unknown>)["gift"]).toBeUndefined();
    expect((liveStarted as unknown as Record<string, unknown>)["count"]).toBeUndefined();
  });

  it("todos los eventos tienen id, timestamp, sessionId y source (envelope, Sección 5)", () => {
    for (const name of ["gift.json", "like.json", "live_started.json"]) {
      const event = loadFixture(name);
      expect(typeof event.id).toBe("string");
      expect(event.id.length).toBeGreaterThan(0);
      expect(typeof event.timestamp).toBe("number");
      expect(typeof event.sessionId).toBe("string");
      expect(["tiktok", "simulation", "system"]).toContain(event.source);
    }
  });
});
