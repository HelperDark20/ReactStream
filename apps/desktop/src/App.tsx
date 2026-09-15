import { useEffect, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "./stores/app.store";
import Topbar from "./components/Topbar";
import Sidebar from "./components/Sidebar";
import Statusbar from "./components/Statusbar";
import HomePage from "./pages/HomePage";

const ActionsPage = lazy(() => import("./pages/ActionsPage"));
const OverlaysPage = lazy(() => import("./pages/OverlaysPage"));
const SoundsPage = lazy(() => import("./pages/SoundsPage"));
const ProPage = lazy(() => import("./pages/ProPage"));

function PageContent() {
  const { activePage } = useAppStore();
  return <Suspense fallback={<PageLoader />}>
    {activePage === "home" && <HomePage />}
    {activePage === "actions" && <ActionsPage />}
    {activePage === "overlays" && <OverlaysPage />}
    {activePage === "sounds" && <SoundsPage />}
    {activePage === "pro" && <ProPage />}
  </Suspense>;
}

function PageLoader() {
  return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--rs-text-muted)" }}>Cargando...</div>;
}

export default function App() {
  const { setVersion, setAppStatus } = useAppStore();
  useEffect(() => {
    invoke<{ version: string; application: string }>("get_status")
      .then((status) => { setVersion(status.version); setAppStatus("READY"); })
      .catch(() => setAppStatus("ERROR"));
  }, [setVersion, setAppStatus]);

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
