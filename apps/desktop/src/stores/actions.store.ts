import { create } from "zustand";

export interface KeystrokeConfig {
  id: string;
  name: string;
  trigger: string;
  giftFilter: string;
  keys: string[];
  repeatCount: number;
  delayMs: number;
  enabled: boolean;
}

export type MediaType = "image" | "audio" | "animation" | "gift_overlay";

export interface MediaAction {
  id: string;
  name: string;
  trigger: string;
  giftFilter: string;
  mediaType: MediaType;
  url: string;
  durationMs: number;
  enabled: boolean;
}

export type AutomationTrigger = "gift" | "like" | "follow" | "comment" | "share" | "member" | "timer_zero";

export interface AutomationAction {
  id: string;
  type: "play_sound" | "keystroke" | "add_timer" | "show_overlay" | "hide_overlay" | "wait";
  label: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: string;
  actions: AutomationAction[];
  cooldownMs: number;
  priority: number;
}

const INITIAL_KEYSTROKES: KeystrokeConfig[] = [
  { id: "ks1", name: "Rosa → Space", trigger: "gift", giftFilter: "5655", keys: ["Space"], repeatCount: 1, delayMs: 0, enabled: true },
  { id: "ks2", name: "Follow → F9 x5", trigger: "follow", giftFilter: "", keys: ["F9"], repeatCount: 5, delayMs: 200, enabled: true },
  { id: "ks3", name: "León → G G G G G", trigger: "gift", giftFilter: "6216", keys: ["G", "G", "G", "G", "G"], repeatCount: 1, delayMs: 150, enabled: false },
  { id: "ks4", name: "Like → Enter", trigger: "like", giftFilter: "", keys: ["Enter"], repeatCount: 1, delayMs: 0, enabled: true },
  { id: "ks5", name: "Comentario → Ctrl + C", trigger: "comment", giftFilter: "", keys: ["Ctrl+C"], repeatCount: 1, delayMs: 0, enabled: false },
  { id: "ks6", name: "Compartida → Alt + S", trigger: "share", giftFilter: "", keys: ["Alt+S"], repeatCount: 1, delayMs: 0, enabled: true },
];

const INITIAL_MEDIAS: MediaAction[] = [
  { id: "m1", name: "Explosión Rosa", trigger: "gift", giftFilter: "5655", mediaType: "animation", url: "http://127.0.0.1:47821/overlay/effects/rose-explosion", durationMs: 3000, enabled: true },
  { id: "m2", name: "Foto León", trigger: "gift", giftFilter: "6216", mediaType: "image", url: "http://127.0.0.1:47821/overlay/effects/lion-image", durationMs: 5000, enabled: true },
  { id: "m3", name: "Confetti Follow", trigger: "follow", giftFilter: "", mediaType: "animation", url: "http://127.0.0.1:47821/overlay/effects/confetti", durationMs: 2000, enabled: false },
];

// ─── Sounds ───────────────────────────────────────────────────

export interface Sound {
  id: string;
  name: string;
  filename: string;
  filePath?: string;
  volume: number;
  enabled: boolean;
  trigger: string;
  giftFilter: string;
}

const INITIAL_SOUNDS: Sound[] = [
  { id: "snd1", name: "Bienvenida", filename: "welcome.mp3", volume: 80, enabled: true, trigger: "follow", giftFilter: "" },
  { id: "snd2", name: "Rosa especial", filename: "rose_special.mp3", volume: 90, enabled: true, trigger: "gift", giftFilter: "5655" },
  { id: "snd3", name: "León épico", filename: "lion_epic.mp3", volume: 100, enabled: true, trigger: "gift", giftFilter: "6216" },
  { id: "snd4", name: "Mega likes", filename: "mega_likes.mp3", volume: 75, enabled: false, trigger: "like", giftFilter: "" },
];

const INITIAL_AUTOMATIONS: Automation[] = [
  { id: "auto1", name: "Rosa combo especial", enabled: true, trigger: "gift", conditions: "gift.id = 5655 · totalCoins ≥ 10", actions: [{ id: "a1", type: "play_sound", label: "Reproducir: snd_rose" }, { id: "a2", type: "keystroke", label: "Tecla: Space (100ms)" }], cooldownMs: 5000, priority: 10 },
  { id: "auto2", name: "Reacción mega likes", enabled: true, trigger: "like", conditions: "count ≥ 50", actions: [{ id: "a3", type: "play_sound", label: "Reproducir: snd_woah" }], cooldownMs: 10000, priority: 10 },
  { id: "auto3", name: "Bienvenida nuevo follow", enabled: false, trigger: "follow", conditions: "Sin condiciones", actions: [{ id: "a4", type: "play_sound", label: "Reproducir: snd_welcome" }], cooldownMs: 0, priority: 20 },
  { id: "auto4", name: "León — reacción épica", enabled: true, trigger: "gift", conditions: "gift.id = 6216", actions: [{ id: "a5", type: "play_sound", label: "Reproducir: snd_epic" }, { id: "a6", type: "keystroke", label: "Tecla: F9 (200ms)" }, { id: "a7", type: "add_timer", label: "Agregar 30 segundos al timer" }], cooldownMs: 0, priority: 1 },
];

interface ActionsState {
  keystrokes: KeystrokeConfig[];
  medias: MediaAction[];
  automations: Automation[];
  sounds: Sound[];
  updateKeystroke: (id: string, patch: Partial<KeystrokeConfig>) => void;
  addKeystroke: (cfg: KeystrokeConfig) => void;
  deleteKeystroke: (id: string) => void;
  updateMedia: (id: string, patch: Partial<MediaAction>) => void;
  addMedia: (m: MediaAction) => void;
  deleteMedia: (id: string) => void;
  updateAutomation: (id: string, patch: Partial<Automation>) => void;
  addAutomation: (a: Automation) => void;
  deleteAutomation: (id: string) => void;
  updateSound: (id: string, patch: Partial<Sound>) => void;
  addSound: (s: Sound) => void;
  deleteSound: (id: string) => void;
}

export const useActionsStore = create<ActionsState>((set) => ({
  keystrokes: INITIAL_KEYSTROKES,
  medias: INITIAL_MEDIAS,
  automations: INITIAL_AUTOMATIONS,
  sounds: INITIAL_SOUNDS,

  updateKeystroke: (id, patch) =>
    set((s) => ({ keystrokes: s.keystrokes.map((k) => k.id === id ? { ...k, ...patch } : k) })),
  addKeystroke: (cfg) =>
    set((s) => ({ keystrokes: [...s.keystrokes, cfg] })),
  deleteKeystroke: (id) =>
    set((s) => ({ keystrokes: s.keystrokes.filter((k) => k.id !== id) })),

  updateMedia: (id, patch) =>
    set((s) => ({ medias: s.medias.map((m) => m.id === id ? { ...m, ...patch } : m) })),
  addMedia: (m) =>
    set((s) => ({ medias: [...s.medias, m] })),
  deleteMedia: (id) =>
    set((s) => ({ medias: s.medias.filter((m) => m.id !== id) })),

  updateAutomation: (id, patch) =>
    set((s) => ({ automations: s.automations.map((a) => a.id === id ? { ...a, ...patch } : a) })),
  addAutomation: (a) =>
    set((s) => ({ automations: [...s.automations, a] })),
  deleteAutomation: (id) =>
    set((s) => ({ automations: s.automations.filter((a) => a.id !== id) })),

  updateSound: (id, patch) =>
    set((s) => ({ sounds: s.sounds.map((snd) => snd.id === id ? { ...snd, ...patch } : snd) })),
  addSound: (snd) =>
    set((s) => ({ sounds: [...s.sounds, snd] })),
  deleteSound: (id) =>
    set((s) => ({ sounds: s.sounds.filter((snd) => snd.id !== id) })),
}));
