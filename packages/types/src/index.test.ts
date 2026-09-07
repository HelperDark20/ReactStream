import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Automation, KeyStrokeAction, PlaySoundAction } from "./index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../../../tests/fixtures/automations");

function loadFixture(name: string): Automation {
  const raw = readFileSync(resolve(FIXTURES_DIR, name), "utf-8");
  return JSON.parse(raw) as Automation;
}

describe("Automation contract fixture (compartido con Rust)", () => {
  it("gift_combo.json cumple el contrato Automation completo", () => {
    const automation = loadFixture("gift_combo.json");

    expect(automation.id).toBe("auto_001");
    expect(automation.enabled).toBe(true);
    expect(automation.trigger.type).toBe("gift");
    expect(automation.conditions).toHaveLength(1);
    expect(automation.conditions[0]!.conditions).toHaveLength(2);
    expect(automation.actions).toHaveLength(2);
    expect(automation.priority).toBe(10);
    expect(automation.cooldown.globalMs).toBe(5000);

    const [playSound, keystroke] = automation.actions;
    expect(playSound!.type).toBe("play_sound");
    expect((playSound as PlaySoundAction).config.soundId).toBe("snd_rose");

    expect(keystroke!.type).toBe("keystroke");
    expect((keystroke as KeyStrokeAction).config.sequence[0]!.keys).toEqual(["space"]);
  });

  it("condiciones anidadas conservan operator y value tipados", () => {
    const automation = loadFixture("gift_combo.json");
    const [cond1, cond2] = automation.conditions[0]!.conditions;
    expect(cond1!.operator).toBe("equals");
    expect(cond1!.value).toBe("5655");
    expect(cond2!.operator).toBe("greater_or_equal");
    expect(cond2!.value).toBe(10);
  });
});
