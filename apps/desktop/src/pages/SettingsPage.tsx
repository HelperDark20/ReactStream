import { useState } from "react";
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
