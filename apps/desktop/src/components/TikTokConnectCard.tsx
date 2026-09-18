import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/app.store";
import tiktokLogo from "../assets/tiktok-logo.jpg";

function normalizeUsername(value: string) {
  return value.replace(/^@+/, "").trim();
}

function isLoginError(err: string): boolean {
  const l = err.toLowerCase();
  return (
    l.includes("session") ||
    l.includes("login") ||
    l.includes("cookie") ||
    l.includes("auth") ||
    l.includes("sesión") ||
    l.includes("not logged") ||
    l.includes("credentials")
  );
}

type BulbTone = "ready" | "connecting" | "waiting" | "live" | "error";

function StatusBulb({ tone }: { tone: BulbTone }) {
  return (
    <svg
      className={`rs-status-bulb rs-status-bulb--${tone}`}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2a7 7 0 0 1 3.54 13.07c-.31.22-.54.57-.54.93v1a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1c0-.36-.23-.71-.54-.93A7 7 0 0 1 12 2z"
        fill="currentColor"
      />
      <path
        d="M9.5 18.5h5M10 20.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TikTokConnectCard() {
  const {
    tiktokUsername,
    tiktokStatus,
    sessionActive,
    setTikTokUsername,
    setTikTokDisplayName,
    setTikTokAvatarUrl,
    setTikTokStatus,
    setSessionActive,
    updateSessionStats,
  } = useAppStore();

  const [username, setUsername] = useState(tiktokUsername);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = tiktokStatus === "CONNECTED";
  const isConnecting = tiktokStatus === "CONNECTING" || connecting;

  async function handleConnect() {
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername || isConnecting) return;

    setUsername(cleanUsername);
    setError(null);
    setConnecting(true);
    setTikTokStatus("CONNECTING");
    setSessionActive(false);
    updateSessionStats({ viewers: 0, maxViewers: 0, totalCoins: 0, totalLikes: 0, sessionDuration: 0 });

    // Si cambia de usuario, limpiar caché de perfil para re-fetchear
    if (cleanUsername !== tiktokUsername) {
      setTikTokAvatarUrl("");
      setTikTokDisplayName("");
    }

    try {
      await invoke("connect_tiktok", { username: cleanUsername });
      setTikTokUsername(cleanUsername);
      // No sobreescribir displayName — lo llenará el polling de App.tsx
      setTikTokStatus("CONNECTED");
    } catch (err) {
      console.error("[tiktok-connect-card] connect_tiktok falló:", err);
      setTikTokStatus("ERROR");
      setError(typeof err === "string" ? err : "No se pudo conectar a TikTok Live");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setConnecting(true);
    try {
      await invoke("disconnect_tiktok").catch(() => {});
    } finally {
      setTikTokStatus("DISCONNECTED");
      setSessionActive(false);
      updateSessionStats({ viewers: 0, maxViewers: 0, totalCoins: 0, totalLikes: 0, sessionDuration: 0 });
      setConnecting(false);
    }
  }

  // Tono visual del indicador
  const tone: BulbTone = error || tiktokStatus === "ERROR"
    ? "error"
    : connected && sessionActive
      ? "live"
      : connected
        ? "waiting"
        : isConnecting
          ? "connecting"
          : "ready";

  // Texto de estado con detección de error de login
  const statusText = error
    ? isLoginError(error)
      ? "Inicia sesión en TikTok primero (botón de perfil)"
      : error
    : connected && sessionActive
      ? `En vivo con @${tiktokUsername}`
      : connected
        ? `@${tiktokUsername} aún no está en vivo`
        : isConnecting
          ? "Conectando a TikTok Live..."
          : "Listo para iniciar Live";

  return (
    <section className="rs-tiktok-connect-card" aria-label="Conectar a TikTok Live">
      <div className="rs-tiktok-connect-main">
        <div className="rs-tiktok-connect-icon" aria-hidden="true">
          <img src={tiktokLogo} alt="" />
        </div>

        <div className="rs-tiktok-connect-field">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
            placeholder="Usuario de TikTok"
            aria-label="Usuario de TikTok"
            disabled={isConnecting || connected}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <button
          className={`rs-tiktok-connect-button${connected ? " rs-tiktok-connect-button--disconnect" : ""}`}
          onClick={connected ? handleDisconnect : handleConnect}
          disabled={isConnecting || (!connected && !normalizeUsername(username))}
          aria-label={connected ? "Desconectar de TikTok Live" : "Conectar a TikTok Live"}
          title={connected ? "Desconectar de TikTok Live" : "Conectar a TikTok Live"}
        >
          {connected ? (
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      <div className={`rs-tiktok-connect-status ${tone}`}>
        <StatusBulb tone={tone} />
        <span>{statusText}</span>
      </div>
    </section>
  );
}
