import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "../stores/app.store";

function FrozenBadge() {
  return (
    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 600 }}>
      Congelado en LIVE
    </span>
  );
}

function SettingRow({ label, desc, frozen, children }: {
  label: string; desc?: string; frozen?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--rs-border)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          {frozen && <FrozenBadge />}
        </div>
        {desc && <div style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--rs-green)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 20, marginBottom: 4, paddingBottom: 6, borderBottom: "1px solid var(--rs-border-green)" }}>
      {children}
    </div>
  );
}

function TikTokLoginSection() {
  const {
    tiktokLoggedIn, tiktokLoginPending, tiktokLoginError,
    tiktokUsername, setTikTokLoginPending, setTikTokLoggedIn,
  } = useAppStore();

  async function handleLogin() {
    setTikTokLoginPending(true);
    try {
      await invoke("tiktok_login");
      // Result arrives via "tiktok-login-result" event in App.tsx
    } catch (e) {
      setTikTokLoginPending(false);
      console.error("[settings] tiktok_login error:", e);
    }
  }

  async function handleLogout() {
    await invoke("tiktok_logout");
    setTikTokLoggedIn(false);
  }

  if (tiktokLoggedIn) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rs-green)", display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {tiktokUsername ? `@${tiktokUsername}` : "Sesión activa"}
          </span>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12, padding: "3px 10px" }} onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        className="btn-green"
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
        <span style={{ fontSize: 11, color: "#f87171" }}>{tiktokLoginError}</span>
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
    <div style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Configuración</h2>
      <p style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 4 }}>
        Los campos marcados como <span style={{ color: "#f59e0b" }}>Congelado en LIVE</span> no pueden editarse mientras hay una sesión activa.
      </p>

      <SectionTitle>⏱ Timer</SectionTitle>
      <SettingRow label="Tiempo inicial" desc="Valor de arranque al iniciar el LIVE (segundos)" frozen>
        <input type="number" value={timerInitial} onChange={(e) => setTimerInitial(Number(e.target.value))} disabled={sessionActive} style={{ width: 80 }} />
        <span style={{ fontSize: 12, color: "var(--rs-text-muted)", marginLeft: 6 }}>seg</span>
      </SettingRow>
      <SettingRow label="Coins por segundo" desc="Cuántas monedas suman 1 segundo al timer" frozen>
        <input type="number" value={coinsPerSec} onChange={(e) => setCoinsPerSec(Number(e.target.value))} disabled={sessionActive} style={{ width: 80 }} />
        <span style={{ fontSize: 12, color: "var(--rs-text-muted)", marginLeft: 6 }}>coins</span>
      </SettingRow>
      <SettingRow label="Reactivar tras llegar a cero" desc="Si llega un regalo después de TIMER_ZERO, el timer vuelve a correr automáticamente" frozen>
        <button className={`rs-toggle ${reactivate ? "on" : "off"}`} onClick={() => !sessionActive && setReactivate(!reactivate)} />
      </SettingRow>

      <SectionTitle>🏆 Rankings</SectionTitle>
      <SettingRow label="Top Donors — cantidad" desc="Editable durante el LIVE sin perder datos acumulados">
        <select value={donorTopN} onChange={(e) => setDonorTopN(Number(e.target.value))} style={{ width: 80 }}>
          {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </SettingRow>
      <SettingRow label="Top Tap Tap — cantidad" desc="Editable durante el LIVE sin perder datos acumulados">
        <select value={tapTopN} onChange={(e) => setTapTopN(Number(e.target.value))} style={{ width: 80 }}>
          {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </SettingRow>

      <SectionTitle>🎮 Cuenta TikTok</SectionTitle>
      <SettingRow label="Iniciar sesión" desc="Autentícate con tu cuenta de TikTok para conectarte sin servicio de firma">
        <TikTokLoginSection />
      </SettingRow>
      <SettingRow label="Username por defecto" desc="Se pre-rellena en el campo de conexión al abrir la app">
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="sin @" style={{ width: 160 }} />
      </SettingRow>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="btn-ghost">Restaurar defaults</button>
        <button className="btn-green">Guardar cambios</button>
      </div>
    </div>
  );
}
