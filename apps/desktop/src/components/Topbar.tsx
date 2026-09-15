import topbarLogo from "../assets/reactstream-rs-mark-transparent.png";
import tiktokLogo from "../assets/tiktok-logo.jpg";
import { useState, type ReactNode } from "react";
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

export default function Topbar() {
  const { tiktokUsername, tiktokDisplayName, tiktokAvatarUrl, setTikTokUsername, setTikTokDisplayName, tiktokStatus, setTikTokStatus, appStatus, sessionActive, sessionDuration, totalCoins, viewers, maxViewers } = useAppStore();
  const [inputUsername, setInputUsername] = useState("");
  const [connecting, setConnecting] = useState(false);
  const isConnected = tiktokStatus === "CONNECTED";
  const isConnecting = tiktokStatus === "CONNECTING";
  const isLive = sessionActive || appStatus === "LIVE";

  async function handleConnect() {
    if (isConnected) {
      await invoke("disconnect_tiktok");
      setTikTokStatus("DISCONNECTED");
      return;
    }
    if (!inputUsername.trim()) return;
    setConnecting(true); setTikTokStatus("CONNECTING");
    try {
      await invoke("connect_tiktok", { username: inputUsername.trim() });
      setTikTokUsername(inputUsername.trim());
      setTikTokDisplayName(inputUsername.trim());
      setTikTokStatus("CONNECTED");
    } catch { setTikTokStatus("ERROR"); }
    finally { setConnecting(false); }
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
              type="text" placeholder="Username sin @"
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
          <span className={`status-dot ${isConnected ? "green" : isConnecting ? "yellow" : "green"}`} />
          <span>{isConnected ? `Conectado a @${tiktokUsername}` : isConnecting ? "Conectando..." : "Listo para conectar"}</span>
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
            <StatItem icon={<ViewersIcon />} label="ESPECTADORES" value={viewers.toLocaleString()} sub={`Máx: ${maxViewers.toLocaleString()}`} />
            <StatDivider />
            <StatItem icon={<CoinsIcon />} label="MONEDAS TOTALES" value={totalCoins.toLocaleString()} accent />
            <StatDivider />
            <StatItem icon={<DurationIcon />} label="DURACIÓN" value="2:45" />
          </div>
        </div>

        <div className={`topbar-live-profile ${isLive ? "is-live" : "is-offline"}`}>
          <div className="live-profile-avatar">
            {tiktokAvatarUrl ? (
              <img src={tiktokAvatarUrl} alt="Foto de perfil de TikTok" />
            ) : (
              <UserIcon />
            )}
            <span className="live-profile-dot" />
          </div>
          <div className="live-profile-copy">
            <div className="live-profile-name">{isLive ? (tiktokDisplayName || tiktokUsername || "TikTok") : "Sin Live"}</div>
            <div className="live-profile-status">
              <span className="status-dot" />
              {isLive ? "En Live" : "Esperando Live"}
            </div>
          </div>
        </div>
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
