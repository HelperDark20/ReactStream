import { useState, type ReactNode } from "react";
import { EventIcon, type EventIconType } from "../../components/icons/EventIcon";
import { UIIcon } from "../../components/icons";
import { useActionsStore, type AutomationTrigger } from "../../stores/actions.store";

const TRIGGERS: { id: AutomationTrigger | "timer_zero"; label: string; icon: EventIconType | null }[] = [
  { id: "gift",       label: "Regalo",       icon: "gift" },
  { id: "like",       label: "Like",          icon: "like" },
  { id: "follow",     label: "Follow",        icon: "follow" },
  { id: "comment",    label: "Comentario",    icon: "comment" },
  { id: "share",      label: "Compartida",    icon: "share" },
  { id: "member",     label: "Nuevo miembro", icon: "member" },
  { id: "timer_zero", label: "Timer 00:00",   icon: null },
];

const TRIGGER_COLORS: Record<string, string> = {
  gift: "#f59e0b", like: "#ef4444", follow: "#39ff14", comment: "#3b82f6",
  share: "#a855f7", member: "#06b6d4", timer_zero: "#f97316",
};

const SIM_EVENTS = ["GIFT - Rosa x10", "LIKE - 50 likes", "FOLLOW - Nuevo usuario", "GIFT - León x1"];

export default function AutomationsPage() {
  const { automations, updateAutomation, addAutomation, deleteAutomation } = useActionsStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [showSim, setShowSim] = useState(false);

  const selectedAuto = automations.find((a) => a.id === selected);

  function handleNew() {
    const id = `auto${Date.now()}`;
    addAutomation({ id, name: "Nueva Automatización", enabled: true, trigger: "gift", conditions: "Sin condiciones", actions: [], cooldownMs: 0, priority: 10 });
    setSelected(id);
    setShowSim(false);
    setSimLog([]);
  }

  function handleDelete() {
    if (!selectedAuto) return;
    const idx = automations.findIndex((a) => a.id === selectedAuto.id);
    deleteAutomation(selectedAuto.id);
    const remaining = automations.filter((a) => a.id !== selectedAuto.id);
    setSelected(remaining[Math.max(0, idx - 1)]?.id ?? null);
    setSimLog([]);
  }

  async function runSimulation() {
    if (!selectedAuto) return;
    setSimRunning(true);
    setSimLog([]);
    const logs: string[] = [];
    for (const event of SIM_EVENTS) {
      await new Promise((r) => setTimeout(r, 600));
      const triggered = event.toLowerCase().includes(selectedAuto.trigger);
      logs.push(`${triggered ? "MATCH" : "SKIP"} · [${event}] → ${triggered ? `"${selectedAuto.name}" disparada` : "sin coincidencia"}`);
      setSimLog([...logs]);
    }
    logs.push("DONE · Simulación completada · Safe Action Mode ON");
    setSimLog([...logs]);
    setSimRunning(false);
  }

  return (
    <div className="keystroke-workspace">
      {/* Lista de automatizaciones */}
      <aside className="keystroke-list-panel">
        <div className="keystroke-list-head">
          <span>AUTOMATIZACIONES</span>
          <button className="module-green-button module-small-button" onClick={handleNew}>+ Nueva</button>
        </div>
        <div className="keystroke-list-scroll">
          {automations.map((auto) => {
            const trig = TRIGGERS.find((t) => t.id === auto.trigger);
            const active = selected === auto.id;
            return (
              <button
                key={auto.id}
                className={`keystroke-list-item ${active ? "active" : ""} ${!auto.enabled ? "disabled" : ""}`}
                onClick={() => { setSelected(auto.id); setShowSim(false); setSimLog([]); }}
              >
                <span className="keystroke-item-icon" style={{ color: TRIGGER_COLORS[auto.trigger] }}>
                  {trig?.icon
                    ? <EventIcon type={trig.icon} size={28} />
                    : <span className="rs-timer-glyph">00</span>}
                </span>
                <span className="keystroke-item-copy">
                  <strong>{auto.name}</strong>
                  <small>{auto.actions.length} acción{auto.actions.length !== 1 ? "es" : ""} · {auto.cooldownMs > 0 ? `cooldown ${auto.cooldownMs / 1000}s` : "sin cooldown"}</small>
                </span>
                <span
                  role="switch"
                  aria-checked={auto.enabled}
                  className={`module-toggle ${auto.enabled ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); updateAutomation(auto.id, { enabled: !auto.enabled }); }}
                >
                  <span />
                </span>
                <span className="keystroke-menu"><UIIcon name="more" size={17} /></span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Panel derecho */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selectedAuto ? (
          <div className="keystroke-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <span className="automation-empty-icon"><UIIcon name="zap" size={30} /></span>
            <p style={{ color: "var(--rs-text-muted)", fontSize: 14 }}>Selecciona una automatización para editarla</p>
            <button className="module-green-button" style={{ marginTop: 4 }} onClick={handleNew}>+ Crear primera automatización</button>
          </div>
        ) : (
          <div className="keystroke-editor">
            {/* Cabecera del editor */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,.10)", marginBottom: 4 }}>
              <span className="rs-automation-trigger-icon">
                {TRIGGERS.find((t) => t.id === selectedAuto.trigger)?.icon
                  ? <EventIcon type={TRIGGERS.find((t) => t.id === selectedAuto.trigger)!.icon!} size={24} />
                  : <span className="rs-timer-glyph">00</span>}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedAuto.name}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: `${TRIGGER_COLORS[selectedAuto.trigger]}22`, color: TRIGGER_COLORS[selectedAuto.trigger], fontWeight: 700 }}>
                {selectedAuto.trigger.toUpperCase()}
              </span>
              <button className="module-ghost-button" style={{ height: 32 }} onClick={() => setShowSim(!showSim)}>
                {showSim ? "Cerrar sim." : "Simular"}
              </button>
              <button className="module-green-button" style={{ height: 32 }}>Guardar</button>
            </div>

            <Section title="Trigger">
              <div className="trigger-row">
                {TRIGGERS.map((t) => {
                  const active = selectedAuto.trigger === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`trigger-chip ${active ? "active" : ""}`}
                      onClick={() => updateAutomation(selectedAuto.id, { trigger: t.id as AutomationTrigger })}
                    >
                      {t.icon
                        ? <EventIcon type={t.icon} size={16} state={active ? "selected" : "default"} />
                        : <UIIcon name="clock" size={14} />}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Condiciones">
              <div style={{ background: "rgba(2,8,5,.46)", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="module-input" style={{ flex: 1 }}>
                    <option>gift.id</option><option>gift.coins</option><option>totalCoins</option><option>quantity</option>
                  </select>
                  <select className="module-input" style={{ width: 130 }}>
                    <option>igual a</option><option>mayor o igual</option><option>menor que</option><option>contiene</option>
                  </select>
                  <input type="text" className="module-input" defaultValue="5655" style={{ width: 90 }} />
                  <button className="module-ghost-button" style={{ height: 36, padding: "0 10px", whiteSpace: "nowrap" }}>+ AND</button>
                </div>
              </div>
              <p className="module-help">Activo: {selectedAuto.conditions}</p>
            </Section>

            <Section title="Acciones (en orden)">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedAuto.actions.map((action, i) => (
                  <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(2,8,5,.46)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9 }}>
                    <span style={{ color: "var(--rs-text-muted)", fontSize: 12, width: 16, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, flex: 1 }}>{action.label}</span>
                    <button className="module-ghost-button" style={{ height: 28, padding: "0 8px", fontSize: 11 }}>Editar</button>
                  </div>
                ))}
                <button className="module-ghost-button" style={{ height: 34, marginTop: 2 }}>+ Agregar acción</button>
              </div>
            </Section>

            <Section title="Cooldown y Prioridad">
              <div className="two-column-fields">
                <label>
                  <span>Cooldown global (ms)</span>
                  <input type="number" className="module-input" defaultValue={selectedAuto.cooldownMs}
                    onBlur={(e) => updateAutomation(selectedAuto.id, { cooldownMs: Number(e.target.value) })} />
                </label>
                <label>
                  <span>Prioridad (1=más alta)</span>
                  <input type="number" className="module-input" defaultValue={selectedAuto.priority}
                    onBlur={(e) => updateAutomation(selectedAuto.id, { priority: Number(e.target.value) })} />
                </label>
              </div>
            </Section>

            {showSim && (
              <Section title="Simulación en tiempo real">
                <div className="simulation-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <select className="module-input" style={{ width: 130 }}>
                      <option>Velocidad 1x</option><option>2x</option><option>5x</option><option>10x</option>
                    </select>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(57,255,20,0.10)", color: "var(--rs-green)", fontWeight: 700 }}>
                      Safe Mode ON
                    </span>
                    <button className="module-green-button" style={{ marginLeft: "auto", height: 32 }} onClick={runSimulation} disabled={simRunning}>
                      {simRunning ? "Ejecutando..." : "Ejecutar"}
                    </button>
                  </div>
                  <div className="simulation-log" style={{ minHeight: 80 }}>
                    {simLog.length === 0 && !simRunning && <span>Presiona Ejecutar para simular eventos contra esta automatización.</span>}
                    {simLog.map((line, i) => (
                      <div key={i} className={line.startsWith("MATCH") || line.startsWith("DONE") ? "automation-log-success" : line.startsWith("SKIP") ? "automation-log-muted" : ""}>
                        {line}
                      </div>
                    ))}
                    {simRunning && <div style={{ color: "var(--rs-text-muted)" }}>Procesando...</div>}
                  </div>
                </div>
              </Section>
            )}

            <div className="editor-actions">
              <button className="module-danger-button" onClick={handleDelete}><UIIcon name="trash" size={14} /> Eliminar</button>
              <button className="module-green-button save-button"><UIIcon name="check" size={14} /> Guardar cambios</button>
            </div>
          </div>
        )}
      </div>
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
