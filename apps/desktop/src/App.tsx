import { useEffect, useRef, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./stores/app.store";
import Sidebar from "./components/Sidebar";
import ProfileCard from "./components/ProfileCard";
import HomePage from "./pages/HomePage";

const ActionsPage = lazy(() => import("./pages/ActionsPage"));
const OverlaysPage = lazy(() => import("./pages/OverlaysPage"));
const SoundsPage = lazy(() => import("./pages/SoundsPage"));
const ProPage = lazy(() => import("./pages/ProPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function PageContent() {
  const { activePage } = useAppStore();
  return (
    <Suspense fallback={<PageLoader />}>
      {activePage === "home" && <HomePage />}
      {activePage === "actions" && <ActionsPage />}
      {activePage === "overlays" && <OverlaysPage />}
      {activePage === "sounds" && <SoundsPage />}
      {activePage === "pro" && <ProPage />}
      {activePage === "settings" && <SettingsPage />}
    </Suspense>
  );
}

function PageLoader() {
  return <div className="rs-page-loader">Cargando...</div>;
}

interface SessionStats {
  totalCoins: number;
  totalLikes: number;
  maxViewers: number;
  currentViewers: number;
  durationSeconds: number;
}

export default function App() {
  const {
    setVersion,
    setAppStatus,
    setTikTokLoggedIn,
    setTikTokLoginError,
    setTikTokDisplayName,
    setTikTokAvatarUrl,
    tiktokStatus,
    updateSessionStats,
    setSessionActive,
  } = useAppStore();
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    invoke<{
      version: string;
      application: string;
      tiktokLoggedIn?: boolean;
      tiktokUsername?: string;
      tiktokDisplayName?: string;
      tiktokAvatarUrl?: string;
    }>("get_status")
      .then((status) => {
        setVersion(status.version);
        setAppStatus("READY");
        if (status.tiktokLoggedIn) {
          setTikTokLoggedIn(true, status.tiktokUsername);
          if (status.tiktokDisplayName) setTikTokDisplayName(status.tiktokDisplayName);
          if (status.tiktokAvatarUrl) setTikTokAvatarUrl(status.tiktokAvatarUrl);
        }
      })
      .catch(() => setAppStatus("ERROR"));
  }, [setVersion, setAppStatus, setTikTokLoggedIn, setTikTokDisplayName, setTikTokAvatarUrl]);

  useEffect(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    if (tiktokStatus !== "CONNECTED") return;

    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await invoke<SessionStats | null>("get_session_stats");
        if (stats) {
          setSessionActive(true);
          updateSessionStats({
            totalCoins: stats.totalCoins,
            totalLikes: stats.totalLikes,
            viewers: stats.currentViewers,
            maxViewers: stats.maxViewers,
            sessionDuration: stats.durationSeconds,
          });
        } else {
          setSessionActive(false);
          updateSessionStats({ viewers: 0 });
        }
      } catch {}
    }, 1000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [tiktokStatus, updateSessionStats, setSessionActive]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ success: boolean; username?: string; error?: string }>(
      "tiktok-login-result",
      ({ payload }) => {
        if (payload.success) {
          setTikTokLoggedIn(true, payload.username);
        } else {
          setTikTokLoginError(payload.error ?? "Error desconocido al iniciar sesión");
        }
      },
    ).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setTikTokLoggedIn, setTikTokLoginError]);

  return (
    <div className="rs-app-shell">
      <main className="rs-main-content">
        <PageContent />
      </main>
      <Sidebar />
      <ProfileCard />
    </div>
  );
}
