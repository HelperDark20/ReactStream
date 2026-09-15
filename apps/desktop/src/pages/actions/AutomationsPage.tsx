import { useState } from "react";

interface Action {
  id: string;
  type: "play_sound" | "keystroke" | "add_timer" | "show_overlay" | "hide_overlay" | "wait";
  label: string;
}

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: "gift" | "like" | "follow" | "comment" | "share" | "member" | "timer_zero";
  conditions: string;
  actions: Action[];
  cooldownMs: number;
  priority: number;
}

const TRIGGER_COLORS: Record<string, string> = {
  gift: "#f59e0b",
  like: "#ef4444",
  follow: "#39ff14",
  comment: "#3b82f6",
  share: "#a855f7",
  member: "#06b6d4",
  timer_zero: "#f97316",
};

const TRIGGER_ICONS: Record<string, string> = {
  gift: "🎁", like: "❤️", follow: "➕", comment: "💬",
  share: "🔗", member: "👤", timer_zero: "⏱",
};

const MOCK_AUTOMATIONS: Automation[] = [
  { id: "1", name: "Rosa combo especial", enabled: true, trigger: "gift",
    conditions: "gift.id = 5655 · totalCoins ≥ 10",
    actions: [{ id: "a1", type: "play_sound", label: "Reproducir: snd_rose" }, { id: "a2", type: "keystroke", label: "Tecla: Space (100ms)" }],
    cooldownMs: 5000, priority: 10 },
  { id: "2", name: "Reacción mega likes", enabled: true, trigger: "like",
    conditions: "count ≥ 50",
    actions: [{ id: "a3", type: "play_sound", label: "Reproducir: snd_woah" }],
    cooldownMs: 10000, priority: 10 },
  { id: "3", name: "Bienvenida nuevo follow", enabled: false, trigger: "follow",
    conditions: "Sin condiciones",
    actions: [{ id: "a4", type: "play_sound", label: "Reproducir: snd_welcome" }],
    cooldownMs: 0, priority: 20 },
  { id: "4", name: "León — reacción épica", enabled: true, trigger: "gift",
    conditions: "gift.id = 6216",
    actions: [
      { id: "a5", type: "play_sound", label: "Reproducir: snd_epic" },
      { id: "a6", type: "keystroke", label: "Tecla: F9 (200ms)" },
      { id: "a7", type: "add_timer", label: "Agregar 30 segundos al timer" },
    ],
    cooldownMs: 0, priority: 1 },
];

const SIM_EVENTS = ["GIFT - Rosa x10", "LIKE - 50 likes", "FOLLOW - Nuevo usuario", "GIFT - León x1"];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState(MOCK_AUTOMATIONS);
  const [selected, setSelected] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [showSim, setShowSim] = useState(false);

  const selectedAuto = automations.find((a) => a.id === selected);

  function toggleEnabled(id: string) {
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }

  async function runSimulation() {
    if (!selectedAuto) return;
    setSimRunning(true);
    setSimLog([]);
    const logs: string[] = [];
    for (const event of SIM_EVENTS) {
      await new Promise((r) => setTimeout(r, 600));
      const triggered = event.toLowerCase().includes(selectedAuto.trigger);
      logs.push(`${triggered ? "✅" : "⏭"} [${event}] → ${triggered ? `"${selectedAuto.name}" disparada` : "sin coincidencia"}`);
      setSimLog([...logs]);
    }
    logs.push("✓ Simulación completada · Safe Action Mode ON");
    setSimLog([...logs]);
    setSimRunning(false);
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Lista de automatizaciones */}
      <div style={{ width: 280, borderRight: "1px solid var(--rs-border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--rs-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--rs-text-secondary)", letterSpacing: "0.08em" }}>
            AUTOMATIZACIONES
          </span>
          <button className="btn-green" style={{ padding: "4px 10px", fontSize: 12 }}>+ Nueva</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {automations.map((auto) => (
            <button
              key={auto.id}
              onClick={() => { setSelected(auto.id); setShowSim(false); setSimLog([]); }}
              style={{
                width: "100%", textAlign: "left", padding: "10px 12px",
                background: selected === auto.id ? "rgba(57,255,20,0.08)" : "var(--rs-bg-card)",
                border: `1px solid ${selected === auto.id ? "var(--rs-border-green)" : "var(--rs-border)"}`,
                borderRadius: 8, cursor: "pointer", opacity: auto.enabled ? 1 : 0.5,
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14, background: `${TRIGGER_COLORS[auto.trigger]}22`, padding: "2px 6px", borderRadius: 4 }}>
                  {TRIGGER_ICONS[auto.trigger]}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--rs-text-primary)", flex: 1 }}>{auto.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleEnabled(auto.id); }}
                  className={`rs-toggle ${auto.enabled ? "on" : "off"}`}
                />
              </div>
              <div style={{ fontSize: 11, color: "var(--rs-text-muted)", marginLeft: 34 }}>
                {auto.actions.length} acción{auto.actions.length !== 1 ? "es" : ""} · {auto.cooldownMs > 0 ? `cooldown ${auto.cooldownMs / 1000}s` : "sin cooldown"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho — editor o bienvenida */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selectedAuto ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 32 }}>⚡</span>
            <span style={{ color: "var(--rs-text-muted)", fontSize: 14 }}>Selecciona una automatización para editarla</span>
            <button className="btn-green" style={{ marginTop: 8 }}>+ Crear primera automatización</button>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Topbar del editor */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--rs-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>{TRIGGER_ICONS[selectedAuto.trigger]}</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{selectedAuto.name}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${TRIGGER_COLORS[selectedAuto.trigger]}22`, color: TRIGGER_COLORS[selectedAuto.trigger], fontWeight: 600 }}>
                {selectedAuto.trigger.toUpperCase()}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setShowSim(!showSim)}>
                  {showSim ? "▼ Cerrar sim." : "▶ Simular"}
                </button>
                <button className="btn-green">Guardar</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Trigger */}
              <Section title="Trigger">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.keys(TRIGGER_ICONS).map((t) => (
                    <button key={t} style={{
                      padding: "6px 12px", borderRadius: 6, border: `1px solid ${t === selectedAuto.trigger ? "var(--rs-border-green)" : "var(--rs-border)"}`,
                      background: t === selectedAuto.trigger ? "rgba(57,255,20,0.08)" : "transparent",
                      color: t === selectedAuto.trigger ? "var(--rs-green)" : "var(--rs-text-secondary)",
                      cursor: "pointer", fontSize: 12, fontWeight: t === selectedAuto.trigger ? 600 : 400,
                    }}>
                      {TRIGGER_ICONS[t]} {t}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Condiciones */}
              <Section title="Condiciones">
                <div style={{ background: "var(--rs-bg-card)", borderRadius: 8, border: "1px solid var(--rs-border)", padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select style={{ flex: 1 }}><option>gift.id</option><option>gift.coins</option><option>totalCoins</option><option>quantity</option></select>
                    <select style={{ width: 120 }}><option>igual a</option><option>mayor o igual</option><option>menor que</option><option>contiene</option></select>
                    <input type="text" defaultValue="5655" style={{ width: 90 }} />
                    <button className="btn-ghost" style={{ fontSize: 12 }}>+ AND</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--rs-text-muted)", marginTop: 4 }}>
                  Activo: {selectedAuto.conditions}
                </div>
              </Section>

              {/* Acciones */}
              <Section title="Acciones (en orden)">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedAuto.actions.map((action, i) => (
                    <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--rs-bg-card)", border: "1px solid var(--rs-border)", borderRadius: 8 }}>
                      <span style={{ color: "var(--rs-text-muted)", fontSize: 12, width: 16 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{action.label}</span>
                      <button className="btn-ghost" style={{ padding: "2px 8px", fontSize: 11 }}>Editar</button>
                    </div>
                  ))}
                  <button className="btn-ghost" style={{ fontSize: 12, marginTop: 2 }}>+ Agregar acción</button>
                </div>
              </Section>

              {/* Cooldown + Prioridad */}
              <Section title="Cooldown y Prioridad">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 6 }}>Cooldown global (ms)</div>
                    <input type="number" defaultValue={selectedAuto.cooldownMs} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--rs-text-secondary)", marginBottom: 6 }}>Prioridad (1=más alta)</div>
                    <input type="number" defaultValue={selectedAuto.priority} style={{ width: "100%" }} />
                  </div>
                </div>
              </Section>

              {/* Panel de simulación integrada */}
              {showSim && (
                <Section title="▶ Simulación en tiempo real">
                  <div style={{ background: "#0a0a0a", border: "1px solid var(--rs-border-green)", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <select style={{ fontSize: 12 }}>
                        <option>Velocidad 1x</option><option>2x</option><option>5x</option><option>10x</option>
                      </select>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(57,255,20,0.1)", color: "var(--rs-green)", fontWeight: 600 }}>
                        Safe Action Mode ON
                      </span>
                      <button className="btn-green" style={{ padding: "4px 14px", fontSize: 12, marginLeft: "auto" }} onClick={runSimulation} disabled={simRunning}>
                        {simRunning ? "Ejecutando..." : "▶ Ejecutar"}
                      </button>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, display: "flex", flexDirection: "column", gap: 4, minHeight: 80 }}>
                      {simLog.length === 0 && !simRunning && (
                        <span style={{ color: "var(--rs-text-muted)" }}>Presiona Ejecutar para simular eventos contra esta automatización.</span>
                      )}
                      {simLog.map((line, i) => (
                        <div key={i} style={{ color: line.startsWith("✅") ? "var(--rs-green)" : line.startsWith("✓") ? "var(--rs-green)" : "var(--rs-text-secondary)" }}>
                          {line}
                        </div>
                      ))}
                      {simRunning && <div style={{ color: "var(--rs-text-muted)" }}>⏳ Procesando...</div>}
                    </div>
                  </div>
                </Section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--rs-text-muted)", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
