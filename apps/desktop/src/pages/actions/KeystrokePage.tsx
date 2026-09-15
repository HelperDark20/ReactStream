import { useState } from "react";
import GiftPickerModal, { type GiftItem } from "../../components/GiftPickerModal";

const TRIGGERS = [
  { id: "gift", icon: "🎁", label: "Regalo específico" },
  { id: "like", icon: "❤️", label: "Likes" },
  { id: "follow", icon: "➕", label: "Nuevo follow" },
  { id: "comment", icon: "💬", label: "Comentario" },
  { id: "share", icon: "🔗", label: "Compartida" },
  { id: "member", icon: "👤", label: "Nuevo miembro" },
  { id: "superfan", icon: "⭐", label: "Super Fan" },
];

interface KeystrokeConfig {
  id: string;
  name: string;
  trigger: string;
  giftFilter: string;
  keys: string[];
  repeatCount: number;
  delayMs: number;
  enabled: boolean;
}

const MOCK: KeystrokeConfig[] = [
  { id: "ks1", name: "Rosa → Space", trigger: "gift", giftFilter: "Rosa", keys: ["Space"], repeatCount: 1, delayMs: 0, enabled: true },
  { id: "ks2", name: "Follow → F9 x5", trigger: "follow", giftFilter: "", keys: ["F9"], repeatCount: 5, delayMs: 200, enabled: true },
  { id: "ks3", name: "León → G G G G G", trigger: "gift", giftFilter: "León", keys: ["G", "G", "G", "G", "G"], repeatCount: 1, delayMs: 150, enabled: false },
];

export default function KeystrokePage() {
  const [configs, setConfigs] = useState<KeystrokeConfig[]>(MOCK);
  const [selected, setSelected] = useState<string | null>(MOCK[0]?.id ?? null);
  const [newKey, setNewKey] = useState("");
  const [simLog, setSimLog] = useState<string[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [autoitInstalled] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);

  const cfg = configs.find((c) => c.id === selected);

  function updateCfg(patch: Partial<KeystrokeConfig>) {
    setConfigs((prev) => prev.map((c) => c.id === selected ? { ...c, ...patch } : c));
  }

  function addKey() {
    if (!newKey.trim() || !cfg) return;
    updateCfg({ keys: [...cfg.keys, newKey.trim().toUpperCase()] });
    setNewKey("");
  }

  function removeKey(idx: number) {
    if (!cfg) return;
    updateCfg({ keys: cfg.keys.filter((_, i) => i !== idx) });
  }

  async function runSim(delayBeforeMs: number) {
    if (!cfg) return;
    setSimRunning(true);
    setSimLog([]);
    const logs: string[] = [];

    if (delayBeforeMs > 0) {
      logs.push(`⏳ Esperando ${delayBeforeMs / 1000}s antes de ejecutar...`);
      setSimLog([...logs]);
      await new Promise((r) => setTimeout(r, delayBeforeMs));
    }

    logs.push(`▶ Ejecutando "${cfg.name}"`);
    setSimLog([...logs]);
    await new Promise((r) => setTimeout(r, 300));

    for (let rep = 0; rep < cfg.repeatCount; rep++) {
      for (const key of cfg.keys) {
        await new Promise((r) => setTimeout(r, Math.max(cfg.delayMs, 80)));
        logs.push(`  ⌨ Pulsar: ${key}`);
        setSimLog([...logs]);
      }
      if (cfg.repeatCount > 1 && rep < cfg.repeatCount - 1) {
        await new Promise((r) => setTimeout(r, cfg.delayMs));
        logs.push(`  ⏸ Delay entre repeticiones: ${cfg.delayMs}ms`);
        setSimLog([...logs]);
      }
    }

    logs.push("✓ Simulación completada · Safe Action Mode ON");
    setSimLog([...logs]);
    setSimRunning(false);
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Lista izquierda */}
      <div style={{ width: 260, borderRight: "1px solid var(--rs-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--rs-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-secondary)", letterSpacing: "0.08em" }}>KEYSTROKE</span>
          <button className="btn-green" style={{ padding: "4px 10px", fontSize: 11 }}>+ Nuevo</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {configs.map((c) => {
            const trig = TRIGGERS.find((t) => t.id === c.trigger);
            return (
              <button
                key={c.id}
                onClick={() => { setSelected(c.id); setSimLog([]); }}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 12px",
                  background: selected === c.id ? "rgba(57,255,20,0.08)" : "rgba(12,16,14,0.72)",
                  border: `1px solid ${selected === c.id ? "var(--rs-border-green)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 10, cursor: "pointer", opacity: c.enabled ? 1 : 0.5, transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span>{trig?.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rs-text-primary)", flex: 1 }}>{c.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfigs((prev) => prev.map((x) => x.id === c.id ? { ...x, enabled: !x.enabled } : x)); }}
                    style={{ width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: c.enabled ? "var(--rs-green)" : "#333", position: "relative", flexShrink: 0 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--rs-text-muted)" }}>
                  {c.keys.join(" → ")} · ×{c.repeatCount}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel derecho */}
      {!cfg ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 32 }}>⌨</span>
          <span style={{ color: "var(--rs-text-muted)", fontSize: 14 }}>Selecciona un KeyStroke para editarlo</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* AutoIt banner */}
          {!autoitInstalled && (
            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>AutoIt no detectado</div>
                <div style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>KeyStroke requiere AutoIt para ejecutar pulsaciones reales en el sistema</div>
              </div>
              <a
                href="https://www.autoitscript.com/files/autoit3/autoit-v3-setup.zip"
                target="_blank" rel="noreferrer"
                style={{ background: "#f59e0b", color: "#000", fontWeight: 700, fontSize: 12, padding: "6px 14px", borderRadius: 7, textDecoration: "none", flexShrink: 0 }}
              >
                Descargar AutoIt
              </a>
            </div>
          )}

          <Section title="Nombre">
            <input value={cfg.name} onChange={(e) => updateCfg({ name: e.target.value })} style={{ width: "100%" }} />
          </Section>

          <Section title="Trigger">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TRIGGERS.map((t) => (
                <button key={t.id} onClick={() => updateCfg({ trigger: t.id })} style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: `1px solid ${cfg.trigger === t.id ? "var(--rs-border-green)" : "var(--rs-border)"}`,
                  background: cfg.trigger === t.id ? "rgba(57,255,20,0.08)" : "transparent",
                  color: cfg.trigger === t.id ? "var(--rs-green)" : "var(--rs-text-secondary)",
                  cursor: "pointer", fontSize: 12, fontWeight: cfg.trigger === t.id ? 700 : 400,
                }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </Section>

          {cfg.trigger === "gift" && (
            <Section title="Filtro de regalo">
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ flex:1, padding:"8px 12px", background:"rgba(5,7,6,0.9)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:13, color: cfg.giftFilter ? "#fff" : "rgba(255,255,255,0.3)", cursor:"pointer" }}
                  onClick={() => setShowGiftPicker(true)}>
                  {cfg.giftFilter || "Seleccionar regalo..."}
                </div>
                {cfg.giftFilter && (
                  <button className="btn-ghost" style={{ fontSize:12, padding:"6px 10px", color:"#ef4444", borderColor:"rgba(239,68,68,0.3)" }}
                    onClick={() => updateCfg({ giftFilter: "" })}>
                    ✕
                  </button>
                )}
                <button className="btn-green" style={{ fontSize:12, padding:"7px 14px" }}
                  onClick={() => setShowGiftPicker(true)}>
                  🎁 Elegir
                </button>
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:5 }}>
                Vacío = cualquier regalo dispara la acción
              </div>
              {showGiftPicker && (
                <GiftPickerModal
                  selectedId={cfg.giftFilter}
                  onSelect={(gift: GiftItem) => updateCfg({ giftFilter: gift.id, name: cfg.name || gift.name })}
                  onClose={() => setShowGiftPicker(false)}
                />
              )}
            </Section>
          )}

          <Section title="Secuencia de teclas">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {cfg.keys.map((k, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(57,255,20,0.08)", border: "1px solid var(--rs-border-green)", borderRadius: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--rs-green)", fontFamily: "monospace" }}>{k}</span>
                  <button onClick={() => removeKey(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--rs-text-muted)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addKey(); }}
                placeholder="Ej: Space, F9, G, Ctrl+C"
                style={{ flex: 1 }}
              />
              <button className="btn-green" onClick={addKey}>Agregar</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--rs-text-muted)", marginTop: 6 }}>
              Presiona Enter para agregar. Puedes escribir combinaciones como Ctrl+C, Alt+F4 queda bloqueado por seguridad.
            </div>
          </Section>

          <Section title="Repetición y delay">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 6 }}>Repetir x veces</div>
                <input type="number" min={1} max={100} value={cfg.repeatCount} onChange={(e) => updateCfg({ repeatCount: Number(e.target.value) })} style={{ width: "100%" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 6 }}>Delay entre pulsaciones (ms)</div>
                <input type="number" min={0} max={5000} value={cfg.delayMs} onChange={(e) => updateCfg({ delayMs: Number(e.target.value) })} style={{ width: "100%" }} />
              </div>
            </div>
          </Section>

          <Section title="Simulación">
            <div style={{ background: "rgba(5,7,6,0.9)", border: "1px solid var(--rs-border-green)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button className="btn-green" onClick={() => runSim(0)} disabled={simRunning} style={{ flex: 1 }}>
                  ▶ Ejecutar ahora
                </button>
                <button className="btn-ghost" onClick={() => runSim(5000)} disabled={simRunning} style={{ flex: 1 }}>
                  ⏱ Ejecutar en 5s
                </button>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12, display: "flex", flexDirection: "column", gap: 3, minHeight: 72 }}>
                {simLog.length === 0 && !simRunning && (
                  <span style={{ color: "var(--rs-text-muted)" }}>Pulsa un botón para simular la secuencia. Safe Action Mode ON — no se pulsarán teclas reales.</span>
                )}
                {simLog.map((line, i) => (
                  <div key={i} style={{ color: line.startsWith("✓") ? "var(--rs-green)" : line.startsWith("  ⌨") ? "#a3e635" : line.startsWith("⏳") ? "#f59e0b" : "var(--rs-text-secondary)" }}>
                    {line}
                  </div>
                ))}
                {simRunning && <div style={{ color: "var(--rs-text-muted)" }}>⏳ Procesando...</div>}
              </div>
            </div>
          </Section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn-ghost" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}>Eliminar</button>
            <button className="btn-green">Guardar cambios</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--rs-text-muted)", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
