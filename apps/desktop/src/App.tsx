import { useEffect, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./stores/app.store";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import Statusbar from "./components/Statusbar";
import HomePage from "./pages/HomePage";

const ActionsPage = lazy(() => import("./pages/ActionsPage"));
const OverlaysPage = lazy(() => import("./pages/OverlaysPage"));
const SoundsPage = lazy(() => import("./pages/SoundsPage"));
const ProPage = lazy(() => import("./pages/ProPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function PageContent() {
  const { activePage } = useAppStore();
  return <Suspense fallback={<PageLoader />}>
    {activePage === "home" && <HomePage />}
    {activePage === "actions" && <ActionsPage />}
    {activePage === "overlays" && <OverlaysPage />}
    {activePage === "sounds" && <SoundsPage />}
    {activePage === "pro" && <ProPage />}
    {activePage === "settings" && <SettingsPage />}
  </Suspense>;
}

function PageLoader() {
  return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--rs-text-muted)" }}>Cargando...</div>;
}

export default function App() {
  const { setVersion, setAppStatus, setTikTokLoggedIn, setTikTokLoginError } = useAppStore();

  useEffect(() => {
    invoke<{ version: string; application: string }>("get_status")
      .then((status) => { setVersion(status.version); setAppStatus("READY"); })
      .catch(() => setAppStatus("ERROR"));
  }, [setVersion, setAppStatus]);

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
      <Topbar />
      <div className="rs-main-row">
        <Sidebar />
        <main className="rs-main-content"><PageContent /></main>
      </div>
      <Statusbar />
    </div>
  );
}
