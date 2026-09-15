import { useState } from "react";

type OverlayId = "timer" | "donors" | "tappers" | "best-gift" | "likes" | "jar";

interface OverlayConfig {
  id: OverlayId;
  icon: string;
  name: string;
  desc: string;
  url: string;
  settings: Record<string, unknown>;
}

const OVERLAYS: OverlayConfig[] = [
  { id: "timer", icon: "⏱", name: "Timer", desc: "Cuenta regresiva alimentada por coins", url: "ws://127.0.0.1:47821/overlay/timer", settings: { initialSeconds: 300, coinsPerSecond: 10, reactivateOnZero: true } },
  { id: "donors", icon: "🏆", name: "Top Donors", desc: "Ranking de donadores por monedas", url: "ws://127.0.0.1:47821/overlay/donors", settings: { topN: 10 } },
  { id: "tappers", icon: "❤️", name: "Top Tap Tap", desc: "Ranking por cantidad de likes", url: "ws://127.0.0.1:47821/overlay/tappers", settings: { topN: 10 } },
  { id: "best-gift", icon: "👑", name: "Mejor Regalo", desc: "Regalo de mayor valor unitario", url: "ws://127.0.0.1:47821/overlay/best-gift", settings: {} },
  { id: "likes", icon: "💚", name: "Likes / Tap Tap", desc: "Corazones flotantes con avatar", url: "ws://127.0.0.1:47821/overlay/likes", settings: { cooldownPerUserMs: 10000 } },
  { id: "jar", icon: "🫙", name: "Gift Jar", desc: "Frasco con regalos, tamaño proporcional", url: "ws://127.0.0.1:47821/overlay/jar", settings: { maxGifts: 50 } },
];

export default function OverlaysPage() {
  const [selected, setSelected] = useState<OverlayId>("timer");
  const ov = OVERLAYS.find((o) => o.id === selected)!;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Lista izquierda */}
      <div style={{ width: 200, borderRight: "1px solid var(--rs-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--rs-border)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-secondary)", letterSpacing: "0.08em" }}>OVERLAYS</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o.id)}
              style={{
                width: "100%", textAlign: "left", padding: "10px 12px",
                background: selected === o.id ? "rgba(57,255,20,0.08)" : "rgba(12,16,14,0.72)",
                border: `1px solid ${selected === o.id ? "var(--rs-border-green)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{o.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: selected === o.id ? 700 : 400, color: selected === o.id ? "var(--rs-green)" : "var(--rs-text-primary)" }}>{o.name}</div>
                  <div style={{ fontSize: 10, color: "var(--rs-text-muted)", marginTop: 1 }}>{o.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar del overlay */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--rs-border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>{ov.icon}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{ov.name}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigator.clipboard.writeText(ov.url)}>
              📋 Copiar URL
            </button>
            <button className="btn-green" style={{ fontSize: 12 }}>Guardar config</button>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Vista previa */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid var(--rs-border)" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--rs-border)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-muted)", letterSpacing: "0.08em" }}>VISTA PREVIA</span>
            </div>
            <div style={{ flex: 1, background: "#000", position: "relative", overflow: "hidden" }}>
              <iframe
                src={`http://127.0.0.1:47821/overlay/${ov.id}`}
                style={{ width: "100%", height: "100%", border: "none", background: "transparent" }}
                title={`Preview ${ov.name}`}
              />
              {/* Overlay de "conectando" cuando no hay LIVE */}
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 8,
                background: "rgba(0,0,0,0.7)",
                pointerEvents: "none",
              }}>
                <span style={{ fontSize: 28 }}>{ov.icon}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Vista previa disponible durante el LIVE</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{ov.url}</span>
              </div>
            </div>
          </div>

          {/* Configuración */}
          <div style={{ width: 280, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-muted)", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
                CONFIGURACIÓN
              </div>
              <OverlaySettings overlay={ov} />
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-muted)", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
                URL PARA OBS
              </div>
              <div style={{ background: "rgba(5,7,6,0.9)", border: "1px solid var(--rs-border)", borderRadius: 8, padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "var(--rs-text-muted)", wordBreak: "break-all", lineHeight: 1.5 }}>
                {ov.url}
              </div>
              <div style={{ fontSize: 11, color: "var(--rs-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                Agrega esta URL como <span style={{ color: "var(--rs-green)" }}>Browser Source</span> en OBS Studio.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverlaySettings({ overlay }: { overlay: OverlayConfig }) {
  const [settings, setSettings] = useState(overlay.settings);

  function update(key: string, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (overlay.id === "timer") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SettingField label="Tiempo inicial (segundos)" frozen>
          <input type="number" value={settings["initialSeconds"] as number} onChange={(e) => update("initialSeconds", Number(e.target.value))} style={{ width: "100%" }} />
        </SettingField>
        <SettingField label="Coins por segundo" frozen>
          <input type="number" value={settings["coinsPerSecond"] as number} onChange={(e) => update("coinsPerSecond", Number(e.target.value))} style={{ width: "100%" }} />
        </SettingField>
        <SettingField label="Reactivar al llegar a cero" frozen>
          <Toggle value={settings["reactivateOnZero"] as boolean} onChange={(v) => update("reactivateOnZero", v)} />
        </SettingField>
      </div>
    );
  }

  if (overlay.id === "donors" || overlay.id === "tappers") {
    return (
      <SettingField label="Cantidad en el ranking (Top N)">
        <select value={settings["topN"] as number} onChange={(e) => update("topN", Number(e.target.value))} style={{ width: "100%" }}>
          {[2, 3, 5, 10, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </SettingField>
    );
  }

  if (overlay.id === "likes") {
    return (
      <SettingField label="Cooldown por usuario (ms)">
        <input type="number" value={settings["cooldownPerUserMs"] as number} onChange={(e) => update("cooldownPerUserMs", Number(e.target.value))} style={{ width: "100%" }} />
      </SettingField>
    );
  }

  if (overlay.id === "jar") {
    return (
      <SettingField label="Máximo de regalos en el frasco">
        <input type="number" value={settings["maxGifts"] as number} onChange={(e) => update("maxGifts", Number(e.target.value))} style={{ width: "100%" }} />
      </SettingField>
    );
  }

  return <div style={{ fontSize: 12, color: "var(--rs-text-muted)" }}>Sin configuración adicional para este overlay.</div>;
}

function SettingField({ label, frozen, children }: { label: string; frozen?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>{label}</span>
        {frozen && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 600 }}>Congelado en LIVE</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: value ? "var(--rs-green)" : "#333", position: "relative", transition: "background 0.2s" }}
      />
      <span style={{ fontSize: 12, color: value ? "var(--rs-green)" : "var(--rs-text-muted)" }}>{value ? "Activado" : "Desactivado"}</span>
    </div>
  );
}
