import { useState, type ReactNode } from "react";
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
  { id: "ks4", name: "Like → Enter", trigger: "like", giftFilter: "", keys: ["Enter"], repeatCount: 1, delayMs: 0, enabled: true },
  { id: "ks5", name: "Comentario → Ctrl + C", trigger: "comment", giftFilter: "", keys: ["Ctrl+C"], repeatCount: 1, delayMs: 0, enabled: false },
  { id: "ks6", name: "Compartida → Alt + S", trigger: "share", giftFilter: "", keys: ["Alt+S"], repeatCount: 1, delayMs: 0, enabled: true },
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
    <div className="keystroke-workspace">
      <aside className="keystroke-list-panel">
        <div className="keystroke-list-head">
          <span>KEYSTROKE</span>
          <button className="module-green-button module-small-button">+ Nuevo</button>
        </div>

        <div className="keystroke-list-scroll">
          {configs.map((c) => {
            const trig = TRIGGERS.find((t) => t.id === c.trigger);
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                className={`keystroke-list-item ${active ? "active" : ""} ${!c.enabled ? "disabled" : ""}`}
                onClick={() => { setSelected(c.id); setSimLog([]); }}
              >
                <span className="keystroke-item-icon">{trig?.icon}</span>
                <span className="keystroke-item-copy">
                  <strong>{c.name}</strong>
                  <small>{c.keys.join(" → ")} · ×{c.repeatCount}</small>
                </span>
                <span
                  role="switch"
                  aria-checked={c.enabled}
                  className={`module-toggle ${c.enabled ? "on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfigs((prev) => prev.map((x) => x.id === c.id ? { ...x, enabled: !x.enabled } : x));
                  }}
                >
                  <span />
                </span>
                <span className="keystroke-menu">⋮</span>
              </button>
            );
          })}
        </div>
      </aside>

      {!cfg ? (
        <div className="keystroke-empty">
          <span>⌨</span>
          <p>Selecciona un KeyStroke para editarlo</p>
        </div>
      ) : (
        <div className="keystroke-editor">
          {!autoitInstalled && (
            <div className="autoit-banner">
              <span className="autoit-icon">⚠</span>
              <div>
                <strong>AutoIt no detectado</strong>
                <span>KeyStroke requiere AutoIt para ejecutar pulsaciones reales en el sistema</span>
              </div>
              <a href="https://www.autoitscript.com/files/autoit3/autoit-v3-setup.zip" target="_blank" rel="noreferrer" className="autoit-button">⇩ Descargar AutoIt</a>
            </div>
          )}

          <Section title="Nombre">
            <input className="module-input" value={cfg.name} onChange={(e) => updateCfg({ name: e.target.value })} />
          </Section>

          <Section title="Trigger">
            <div className="trigger-row">
              {TRIGGERS.map((t) => {
                const active = cfg.trigger === t.id;
                return (
                  <button key={t.id} className={`trigger-chip ${active ? "active" : ""}`} onClick={() => updateCfg({ trigger: t.id })}>
                    <span>{t.icon}</span>{t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {cfg.trigger === "gift" && (
            <Section title="Filtro de regalo (nombre o ID)">
              <div className="gift-filter-row">
                <button className={`module-input gift-filter ${cfg.giftFilter ? "filled" : ""}`} onClick={() => setShowGiftPicker(true)}>
                  {cfg.giftFilter || "Seleccionar regalo..."}
                </button>
                {cfg.giftFilter && <button className="icon-danger-button" onClick={() => updateCfg({ giftFilter: "" })}>×</button>}
                <button className="module-green-button" onClick={() => setShowGiftPicker(true)}>🎁 Elegir</button>
              </div>
              <p className="module-help">Vacío = cualquier regalo dispara la acción</p>
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
            <div className="key-chips">
              {cfg.keys.map((k, i) => (
                <span key={i} className="key-chip">
                  {k}<button onClick={() => removeKey(i)}>×</button>
                </span>
              ))}
            </div>
            <div className="add-key-row">
              <input className="module-input" value={newKey} onChange={(e) => setNewKey(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addKey(); }} placeholder="Ej: Space, F9, G, Ctrl+C" />
              <button className="module-green-button" onClick={addKey}>Agregar</button>
            </div>
            <p className="module-help">Presiona Enter para agregar. Puedes escribir combinaciones como Ctrl+C, Alt+F4 queda bloqueado por seguridad.</p>
          </Section>

          <Section title="Repetición y delay">
            <div className="two-column-fields">
              <label><span>Repetir x veces</span><input className="module-input" type="number" min={1} max={100} value={cfg.repeatCount} onChange={(e) => updateCfg({ repeatCount: Number(e.target.value) })} /></label>
              <label><span>Delay entre pulsaciones (ms)</span><input className="module-input" type="number" min={0} max={5000} value={cfg.delayMs} onChange={(e) => updateCfg({ delayMs: Number(e.target.value) })} /></label>
            </div>
          </Section>

          <Section title="Simulación">
            <div className="simulation-card">
              <div className="simulation-buttons">
                <button className="module-green-button simulation-run" onClick={() => runSim(0)} disabled={simRunning}>▶ Ejecutar ahora</button>
                <button className="module-ghost-button simulation-run" onClick={() => runSim(5000)} disabled={simRunning}>◷ Ejecutar en 5s</button>
              </div>
              <div className="simulation-log">
                {simLog.length === 0 && !simRunning && <span>Pulsa un botón para simular la secuencia. Safe Action Mode ON — no se pulsarán teclas reales.</span>}
                {simLog.map((line, i) => <div key={i} className={line.startsWith("✓") ? "log-success" : line.startsWith("⏳") ? "log-warning" : ""}>{line}</div>)}
                {simRunning && <div>⏳ Procesando...</div>}
              </div>
            </div>
          </Section>

          <div className="editor-actions">
            <button className="module-danger-button">Eliminar</button>
            <button className="module-green-button save-button">▣ Guardar cambios</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="module-section">
      <div className="module-section-title">{title}</div>
      {children}
    </section>
  );
}
