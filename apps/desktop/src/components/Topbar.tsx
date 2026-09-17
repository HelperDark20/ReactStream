import topbarLogo from "../assets/reactstream-rs-mark-transparent.png";
import tiktokLogo from "../assets/tiktok-logo.jpg";
import { useState, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/app.store";
import { LiveClockIcon, ViewersIcon, CoinsIcon, DurationIcon, UserIcon } from "./icons";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const Icon = ({ children }: { children: ReactNode }) => <span className="topbar-icon">{children}</span>;

function TikTokProfilePanel({
  isLive,
  tiktokLoggedIn,
  showProfile,
  tiktokLoginPending,
  tiktokUsername,
  tiktokDisplayName,
  tiktokAvatarUrl,
  onLogin,
  onLogout,
}: {
  isLive: boolean;
  tiktokLoggedIn: boolean;
  showProfile: boolean;
  tiktokLoginPending: boolean;
  tiktokUsername: string;
  tiktokDisplayName: string;
  tiktokAvatarUrl: string;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const initials = tiktokUsername ? tiktokUsername.slice(0, 2).toUpperCase() : "TT";

  if (showProfile) {
    return (
      <div className={`topbar-live-profile ${isLive ? "is-live" : "is-offline"}`}>
        {/* Avatar con botón de cerrar sesión en hover */}
        <div className="live-profile-avatar" style={{ position: "relative" }}>
          {tiktokAvatarUrl ? (
            <img
              src={tiktokAvatarUrl}
              alt="Foto de perfil"
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : null}
          {!tiktokAvatarUrl && (
            <div style={{
              width: "100%", height: "100%", display: "flex", alignItems: "center",
              justifyContent: "center", background: "rgba(57,255,20,0.15)",
              borderRadius: "50%", fontSize: 13, fontWeight: 700, color: "var(--rs-green)",
              letterSpacing: "0.04em",
            }}>{initials}</div>
          )}
          {isLive && <span className="live-profile-dot" />}
          {/* Overlay de cerrar sesión — solo cuando hay sesión WebView */}
          {tiktokLoggedIn && <button
            onClick={onLogout}
            title="Cerrar sesión de TikTok"
            className="live-profile-logout-btn"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>}
        </div>

        <div className="live-profile-copy">
          <div className="live-profile-username">{tiktokUsername ? `@${tiktokUsername}` : "—"}</div>
          <div className="live-profile-name">
            {tiktokDisplayName && tiktokDisplayName !== tiktokUsername
              ? tiktokDisplayName
              : tiktokUsername || "—"}
          </div>
          <div className="live-profile-status">
            <span className={`status-dot ${isLive ? "green" : "gray"}`} />
            {isLive ? "En Live" : "Conectado"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="topbar-live-profile is-offline">
      <div className="live-profile-avatar">
        <div style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center",
          justifyContent: "center", background: "rgba(255,255,255,0.04)",
          borderRadius: "50%", color: "rgba(255,255,255,0.2)",
        }}><UserIcon /></div>
      </div>
      <button
        className="btn-green topbar-tiktok-login"
        onClick={onLogin}
        disabled={tiktokLoginPending}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 1 1 0-5.78c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 1 0 6.33 6.34V9.2a8.16 8.16 0 0 0 4.77 1.52V7.27a4.85 4.85 0 0 1-1-.58z" />
        </svg>
        {tiktokLoginPending ? "Abriendo..." : "Conectar TikTok"}
      </button>
    </div>
  );
}

export default function Topbar() {
  const {
    tiktokUsername,
    tiktokDisplayName,
    tiktokAvatarUrl,
    setTikTokUsername,
    setTikTokDisplayName,
    setTikTokAvatarUrl,
    tiktokStatus,
    setTikTokStatus,
    appStatus,
    sessionActive,
    sessionDuration,
    totalCoins,
    viewers,
    maxViewers,
    tiktokLoggedIn,
    tiktokLoginPending,
    setTikTokLoginPending,
    setTikTokLoggedIn,
    updateSessionStats,
    setSessionActive,
  } = useAppStore();
  const [inputUsername, setInputUsername] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnected = tiktokStatus === "CONNECTED";
  const isConnecting = tiktokStatus === "CONNECTING";
  const isLive = sessionActive || appStatus === "LIVE";

  function stopStatusPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startStatusPoll() {
    stopStatusPoll();
    let attempts = 0;
    let profileReceived = false;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const s = await invoke<{ status: string; message: string } | null>("get_bridge_status");
        if (s) {
          stopStatusPoll();
          setBridgeError(s.message);
          setTikTokStatus("DISCONNECTED");
          await invoke("disconnect_tiktok");
          resetLiveStats();
          return;
        }
      } catch {}
      // Consultar datos de perfil (foto + nombre real) hasta recibirlos o timeout 30s
      if (!profileReceived) {
        try {
          const p = await invoke<{ avatarUrl: string; displayName: string } | null>("get_tiktok_profile");
          if (p) {
            profileReceived = true;
            if (p.avatarUrl) setTikTokAvatarUrl(p.avatarUrl);
            if (p.displayName) setTikTokDisplayName(p.displayName);
            // Persistir en disco para restaurar al reiniciar
            invoke("save_tiktok_profile", {
              avatarUrl: p.avatarUrl ?? "",
              displayName: p.displayName ?? "",
            }).catch(() => {});
          }
        } catch {}
      }
      if (attempts >= 30) stopStatusPoll();
    }, 1000);
  }

  function resetLiveStats() {
    setSessionActive(false);
    updateSessionStats({ viewers: 0, maxViewers: 0, totalCoins: 0, totalLikes: 0, sessionDuration: 0 });
  }

  async function handleConnect() {
    if (isConnected) {
      stopStatusPoll();
      setBridgeError(null);
      await invoke("disconnect_tiktok");
      setTikTokStatus("DISCONNECTED");
      resetLiveStats();
      return;
    }
    if (!inputUsername.trim()) return;
    setBridgeError(null);
    resetLiveStats();
    setConnecting(true); setTikTokStatus("CONNECTING");
    try {
      await invoke("connect_tiktok", { username: inputUsername.trim() });
      setTikTokUsername(inputUsername.trim());
      setTikTokDisplayName(inputUsername.trim());
      setTikTokStatus("CONNECTED");
      startStatusPoll();
    } catch (err) {
      console.error("[topbar] connect_tiktok falló:", err);
      setBridgeError(typeof err === "string" ? err : "Error al iniciar el bridge");
      setTikTokStatus("ERROR");
    }
    finally { setConnecting(false); }
  }

  async function handleTikTokLogin() {
    setTikTokLoginPending(true);
    setBridgeError(null);
    try {
      await invoke("tiktok_login");
    } catch (err) {
      console.error("[topbar] tiktok_login falló:", err);
      setTikTokLoginPending(false);
      setBridgeError(typeof err === "string" ? err : "No se pudo abrir TikTok");
    }
  }

  async function handleTikTokLogout() {
    stopStatusPoll();
    await invoke("disconnect_tiktok").catch(() => {});
    await invoke("tiktok_logout").catch(() => {});
    setTikTokLoggedIn(false);
    setTikTokStatus("DISCONNECTED");
    setBridgeError(null);
    resetLiveStats();
  }

  return (
    <header className="rs-topbar">
      <div className="topbar-logo-panel">
        <div className="topbar-brand">
          <img className="topbar-brand-mark" src={topbarLogo} alt="RS" />
          <div className="topbar-brand-name"><span>React</span><strong>Stream</strong></div>
          <div className="topbar-brand-tagline">ELEVATE YOUR LIVE</div>
        </div>
      </div>

      <div className="topbar-connection rs-card">
        <div className="tiktok-mark"><img src={tiktokLogo} alt="TikTok" /></div>
        <div className="card-heading">CONEXIÓN A TIKTOK LIVE</div>
        <div className="connection-row">
          <div className="username-input-wrap">
            <Icon><UserIcon /></Icon>
            <input
              type="text"
              placeholder="Username sin @"
              value={isConnected ? tiktokUsername : inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              disabled={isConnected || isConnecting}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>
          <button className="btn-green" onClick={handleConnect} disabled={connecting}>
            {isConnected ? "DESCONECTAR" : isConnecting ? "..." : "CONECTAR"}
          </button>
        </div>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? "green" : isConnecting ? "yellow" : bridgeError ? "red" : "green"}`} />
          <span style={bridgeError ? { color: "#fca5a5" } : undefined}>
            {isConnected
              ? `Conectado a @${tiktokUsername}`
              : isConnecting
              ? "Conectando..."
              : bridgeError
              ? bridgeError
              : "Listo para conectar"}
          </span>
          {bridgeError && (
            <button
              onClick={() => setBridgeError(null)}
              style={{ marginLeft: 6, background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >×</button>
          )}
        </div>
      </div>

      <div className="topbar-stats rs-card">
        <div className="stats-main">
          <div className="stats-title-row">
            <span className="card-heading">ESTADÍSTICAS DEL LIVE</span>
          </div>
          <div className="stats-grid">
            <StatItem icon={<LiveClockIcon />} label="TIEMPO EN LIVE" value={formatTime(sessionDuration)} />
            <StatDivider />
            <StatItem icon={<ViewersIcon />} label="ESPECTADORES" value={viewers.toLocaleString()} sub={`Máx. ${maxViewers.toLocaleString()}`} />
            <StatDivider />
            <StatItem icon={<CoinsIcon />} label="MONEDAS TOTALES" value={totalCoins.toLocaleString()} accent />
            <StatDivider />
            <StatItem icon={<DurationIcon />} label="DURACIÓN" value={formatTime(sessionDuration)} />
          </div>
        </div>

        <TikTokProfilePanel
          isLive={isLive}
          tiktokLoggedIn={tiktokLoggedIn}
          showProfile={tiktokLoggedIn || isConnected}
          tiktokLoginPending={tiktokLoginPending}
          tiktokUsername={tiktokUsername}
          tiktokDisplayName={tiktokDisplayName}
          tiktokAvatarUrl={tiktokAvatarUrl}
          onLogin={handleTikTokLogin}
          onLogout={handleTikTokLogout}
        />
      </div>
    </header>
  );
}

function StatDivider() { return <div className="stat-divider" />; }

function StatItem({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return <div className="stat-item">
    <div className={`stat-icon ${accent ? "coin" : ""}`}>{icon}</div>
    <div className="stat-copy">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${accent ? "accent" : ""}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>;
}
