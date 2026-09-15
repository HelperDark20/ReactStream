import { create } from "zustand";

export type AppStatus =
  | "STARTING"
  | "READY"
  | "CONNECTING"
  | "CONNECTED"
  | "LIVE"
  | "RECONNECTING"
  | "ERROR";

export type TikTokConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export type ActivePage = "home" | "actions" | "overlays" | "sounds" | "pro";

interface AppState {
  // Estado de la app
  appStatus: AppStatus;
  tiktokStatus: TikTokConnectionStatus;
  tiktokUsername: string;
  tiktokDisplayName: string;
  tiktokAvatarUrl: string;
  version: string;

  // Sesión activa
  sessionActive: boolean;
  sessionDuration: number; // segundos
  totalCoins: number;
  totalLikes: number;
  viewers: number;
  maxViewers: number;

  // Navegación
  activePage: ActivePage;

  // Acciones
  setActivePage: (page: ActivePage) => void;
  setTikTokUsername: (username: string) => void;
  setTikTokDisplayName: (name: string) => void;
  setTikTokAvatarUrl: (url: string) => void;
  setTikTokStatus: (status: TikTokConnectionStatus) => void;
  setAppStatus: (status: AppStatus) => void;
  setVersion: (version: string) => void;
  setSessionActive: (active: boolean) => void;
  updateSessionStats: (stats: Partial<{
    sessionDuration: number;
    totalCoins: number;
    totalLikes: number;
    viewers: number;
    maxViewers: number;
  }>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  appStatus: "STARTING",
  tiktokStatus: "DISCONNECTED",
  tiktokUsername: "",
  tiktokDisplayName: "",
  tiktokAvatarUrl: "",
  version: "1.0.0",
  sessionActive: false,
  sessionDuration: 0,
  totalCoins: 0,
  totalLikes: 0,
  viewers: 0,
  maxViewers: 0,
  activePage: "home",

  setActivePage: (page) => set({ activePage: page }),
  setTikTokUsername: (username) => set({ tiktokUsername: username }),
  setTikTokDisplayName: (name) => set({ tiktokDisplayName: name }),
  setTikTokAvatarUrl: (url) => set({ tiktokAvatarUrl: url }),
  setTikTokStatus: (status) => set({ tiktokStatus: status }),
  setAppStatus: (status) => set({ appStatus: status }),
  setVersion: (version) => set({ version }),
  setSessionActive: (active) => set({ sessionActive: active }),
  updateSessionStats: (stats) => set((state) => ({ ...state, ...stats })),
}));
