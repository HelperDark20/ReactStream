import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/app.store";
import { GeneralSettingsIcon, UIIcon } from "../components/icons";
import background from "../assets/reactstream-background.svg";

function FrozenBadge() {
  return <span className="frozen-badge">Congelado en LIVE</span>;
}

function SettingRow({ label, desc, frozen, children }: {
  label: string; desc?: string; frozen?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-label">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          {frozen && <FrozenBadge />}
        </div>
        {desc && <div style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>{desc}</div>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="settings-section-title">
      {icon && <span>{icon}</span>}
      {children}
    </div>
  );
}

function TikTokLoginSection() {
  const {
    tiktokLoggedIn, tiktokLoginPending, tiktokLoginError,
    tiktokUsername, setTikTokLoginPending, setTikTokLoggedIn,
  } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [sessionDebug, setSessionDebug] = useState<string | null>(null);

  async function handleLogin() {
    setTikTokLoginPending(true);
    try {
      await invoke("tiktok_login");
    } catch (e) {
      setTikTokLoginPending(false);
      console.error("[settings] tiktok_login error:", e);
    }
  }

  async function handleLogout() {
    await invoke("tiktok_logout");
    setTikTokLoggedIn(false);
    setSessionDebug(null);
  }

  async function handleCopySession() {
    try {
      const session = await invoke<{ sessionId: string; ttTargetIdc: string; username: string; cookieString: string } | null>("get_tiktok_session");
      if (!session?.sessionId) {
        setSessionDebug("sessionId vacío — la extracción de cookies falló");
        return;
      }
      const envCmd = [
        `$env:REACTSTREAM_TIKTOK_SESSION_ID = "${session.sessionId}"`,
        `$env:REACTSTREAM_TIKTOK_COOKIES = "${session.cookieString.replace(/"/g, '\\"')}"`,
      ].join("\n");
      await navigator.clipboard.writeText(envCmd);
      setSessionDebug(`Copiado (${session.cookieString.split(";").length} cookies)`);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      setSessionDebug(String(e));
    }
  }

  if (tiktokLoggedIn) {
    return (
      <div className="tiktok-login-status">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="status-dot online" />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {tiktokUsername ? `@${tiktokUsername}` : "Sesión activa"}
          </span>
          <button className="module-ghost-button module-small-button" onClick={handleCopySession}>
            {copied ? "Copiado!" : "Copiar sessionId"}
          </button>
          <button className="module-ghost-button module-small-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
        {sessionDebug && (
          <span className={`session-debug ${sessionDebug.includes("vacío") || sessionDebug.includes("Error") ? "error" : "success"}`}>
            {sessionDebug}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="tiktok-login-status">
      <button
        className="module-green-button"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
        onClick={handleLogin}
        disabled={tiktokLoginPending}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V9.2a8.16 8.16 0 0 0 4.77 1.52V7.27a4.85 4.85 0 0 1-1-.58z"/>
        </svg>
        {tiktokLoginPending ? "Abriendo TikTok..." : "Conectar cuenta TikTok"}
      </button>
      {tiktokLoginError && (
        <span className="session-debug error">{tiktokLoginError}</span>
      )}
      <span style={{ fontSize: 11, color: "var(--rs-text-muted)" }}>
        Se abrirá una ventana de TikTok para iniciar sesión con tu cuenta.
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { tiktokUsername, sessionActive } = useAppStore();
  const [timerInitial, setTimerInitial] = useState(300);
  const [coinsPerSec, setCoinsPerSec] = useState(10);
  const [reactivate, setReactivate] = useState(true);
  const [donorTopN, setDonorTopN] = useState(10);
  const [tapTopN, setTapTopN] = useState(10);
  const [username, setUsername] = useState(tiktokUsername);

  return (
    <section className="actions-module-shell">
      <img className="actions-module-background" src={background} alt="" draggable={false} />

      <header className="actions-module-header">
        <div className="actions-module-title-row">
          <GeneralSettingsIcon className="actions-module-title-icon" />
          <div>
            <h1>Configuración</h1>
            <p>Ajusta los parámetros globales de ReactStream</p>
          </div>
        </div>
      </header>

      <div className="actions-module-card">
        <div className="actions-module-content settings-content">

          <SectionTitle icon="⏱">Timer</SectionTitle>
          <SettingRow label="Tiempo inicial" desc="Valor de arranque al iniciar el LIVE (segundos)" frozen>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" className="module-input" value={timerInitial}
                onChange={(e) => setTimerInitial(Number(e.target.value))}
                disabled={sessionActive} style={{ width: 80 }} />
              <span style={{ fontSize: 12, color: "var(--rs-text-muted)" }}>seg</span>
            </div>
          </SettingRow>
          <SettingRow label="Coins por segundo" desc="Cuántas monedas suman 1 segundo al timer" frozen>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" className="module-input" value={coinsPerSec}
                onChange={(e) => setCoinsPerSec(Number(e.target.value))}
                disabled={sessionActive} style={{ width: 80 }} />
              <span style={{ fontSize: 12, color: "var(--rs-text-muted)" }}>coins</span>
            </div>
          </SettingRow>
          <SettingRow
            label="Reactivar tras llegar a cero"
            desc="Si llega un regalo después de TIMER_ZERO, el timer vuelve a correr automáticamente"
            frozen
          >
            <span
              role="switch"
              aria-checked={reactivate}
              className={`module-toggle ${reactivate ? "on" : ""}`}
              style={{ cursor: sessionActive ? "not-allowed" : "pointer" }}
              onClick={() => !sessionActive && setReactivate(!reactivate)}
            >
              <span />
            </span>
          </SettingRow>

          <SectionTitle icon="🏆">Rankings</SectionTitle>
          <SettingRow label="Top Donors — cantidad" desc="Editable durante el LIVE sin perder datos acumulados">
            <select className="module-input" value={donorTopN}
              onChange={(e) => setDonorTopN(Number(e.target.value))} style={{ width: 90 }}>
              {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </SettingRow>
          <SettingRow label="Top Tap Tap — cantidad" desc="Editable durante el LIVE sin perder datos acumulados">
            <select className="module-input" value={tapTopN}
              onChange={(e) => setTapTopN(Number(e.target.value))} style={{ width: 90 }}>
              {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </SettingRow>

          <SectionTitle icon="🎮">Cuenta TikTok</SectionTitle>
          <SettingRow label="Iniciar sesión" desc="Autentícate con tu cuenta de TikTok para conectarte sin servicio de firma">
            <TikTokLoginSection />
          </SettingRow>
          <SettingRow label="Username por defecto" desc="Se pre-rellena en el campo de conexión al abrir la app">
            <input type="text" className="module-input" value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="sin @" style={{ width: 160 }} />
          </SettingRow>

          <div className="settings-footer-actions">
            <button className="module-ghost-button"><UIIcon name="x" size={14} /> Restaurar defaults</button>
            <button className="module-green-button"><UIIcon name="check" size={14} /> Guardar cambios</button>
          </div>

        </div>
      </div>
    </section>
  );
}
