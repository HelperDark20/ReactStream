import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/app.store";
import { UserIcon } from "./icons";

type LiveTone = "live" | "waiting" | "connecting" | "error";

interface LiveStatus {
  tone: LiveTone;
  text: string;
}

function getLiveStatus(
  tiktokStatus: string,
  sessionActive: boolean,
): LiveStatus {
  if (tiktokStatus === "CONNECTED" && sessionActive)
    return { tone: "live", text: "EN VIVO" };
  if (tiktokStatus === "CONNECTING")
    return { tone: "connecting", text: "CONECTANDO..." };
  if (tiktokStatus === "ERROR")
    return { tone: "error", text: "ERROR" };
  if (tiktokStatus === "CONNECTED")
    return { tone: "waiting", text: "ESPERANDO LIVE" };
  return { tone: "waiting", text: "ESPERANDO LIVE" };
}

export default function ProfileCard() {
  const {
    tiktokUsername,
    tiktokDisplayName,
    tiktokAvatarUrl,
    tiktokStatus,
    tiktokLoggedIn,
    tiktokLoginPending,
    sessionActive,
    setTikTokLoggedIn,
    setTikTokStatus,
    setSessionActive,
    updateSessionStats,
    setTikTokLoginPending,
  } = useAppStore();

  const [hovered, setHovered] = useState(false);

  const connected = tiktokStatus === "CONNECTED" || Boolean(tiktokUsername || tiktokAvatarUrl);
  const hasSession = tiktokLoggedIn || connected;
  const name = tiktokDisplayName || tiktokUsername;
  const initials = (name || "").replace(/[^a-zA-ZÀ-ÿ]/g, "").slice(0, 2).toUpperCase() || "TT";

  const liveStatus = getLiveStatus(tiktokStatus, sessionActive);

  async function handleLogin() {
    setTikTokLoginPending(true);
    try {
      await invoke("tiktok_login");
    } catch {
      setTikTokLoginPending(false);
    }
  }

  async function handleLogout() {
    await invoke("disconnect_tiktok").catch(() => {});
    await invoke("tiktok_logout").catch(() => {});
    setTikTokLoggedIn(false);
    setTikTokStatus("DISCONNECTED");
    setSessionActive(false);
    updateSessionStats({ viewers: 0, maxViewers: 0, totalCoins: 0, totalLikes: 0, sessionDuration: 0 });
  }

  // Sin sesión — avatar vacío + botón login
  if (!hasSession) {
    return (
      <div className="rs-profile-card">
        <div className="rs-profile-avatar rs-profile-avatar--empty">
          <UserIcon />
        </div>
        <div className="rs-profile-login-area">
          <button
            className="rs-profile-connect-btn"
            onClick={handleLogin}
            disabled={tiktokLoginPending}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 1 1 0-5.78c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 1 0 6.33 6.34V9.2a8.16 8.16 0 0 0 4.77 1.52V7.27a4.85 4.85 0 0 1-1-.58z" />
            </svg>
            {tiktokLoginPending ? "Abriendo..." : "Conectar TikTok"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
              <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
            </svg>
          </button>
          <span className="rs-profile-login-hint">Inicia sesión para ver tu perfil</span>
        </div>
      </div>
    );
  }

  // Con sesión — avatar + nombre + estado de live
  return (
    <div className={`rs-profile-card rs-profile-card--connected${sessionActive ? " rs-profile-card--live" : ""}`}>
      <div
        className="rs-profile-avatar"
        style={{ cursor: "pointer", overflow: "hidden", position: "relative" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleLogout}
        title="Cerrar sesión de TikTok"
      >
        {tiktokAvatarUrl ? (
          <img
            src={tiktokAvatarUrl}
            alt="Foto de perfil"
            referrerPolicy="no-referrer"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "filter 0.2s",
              filter: hovered ? "blur(2px) brightness(0.45)" : "none",
            }}
          />
        ) : (
          <span style={{ transition: "opacity 0.2s", opacity: hovered ? 0.4 : 1 }}>
            {initials}
          </span>
        )}

        {hovered && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              pointerEvents: "none",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.95)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        )}
      </div>

      <div className="rs-profile-copy">
        <strong>{name || tiktokUsername}</strong>
        <span>{tiktokUsername ? `@${tiktokUsername}` : "—"}</span>
        <div className={`rs-profile-live-line rs-profile-live-line--${liveStatus.tone}`}>
          <span className="rs-profile-live-dot" />
          {liveStatus.text}
        </div>
      </div>
    </div>
  );
}
