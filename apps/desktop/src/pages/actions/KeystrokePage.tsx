import { useState, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EventIcon, GiftIcon, type EventIconType } from "../../components/icons/EventIcon";
import { UIIcon } from "../../components/icons";
import GiftPickerModal, { GIFT_CATALOG, type GiftItem } from "../../components/GiftPickerModal";
import { useActionsStore } from "../../stores/actions.store";

interface TikTokEvent {
  type: string;
  giftId?: string;
  count?: number;
  username?: string;
  text?: string;
}

const TRIGGERS: { id: EventIconType; label: string }[] = [
  { id: "gift", label: "Regalo específico" },
  { id: "like", label: "Likes" },
  { id: "follow", label: "Nuevo follow" },
  { id: "comment", label: "Comentario" },
  { id: "share", label: "Compartida" },
  { id: "member", label: "Nuevo miembro" },
  { id: "superfan", label: "Super Fan" },
];

function getGiftById(id: string): GiftItem | null {
  if (!id) return null;
  try {
    const raw = localStorage.getItem("reactstream_gift_catalog_v2");
    if (raw) {
      const catalog = JSON.parse(raw) as GiftItem[];
      const cached = catalog.find((gift) => gift.id === id);
      if (cached) return cached;
    }
  } catch {}
  return GIFT_CATALOG.find((gift) => gift.id === id) ?? null;
}

export default function KeystrokePage() {
  const { keystrokes, updateKeystroke, addKeystroke, deleteKeystroke } = useActionsStore();
  const [selected, setSelected] = useState<string | null>(keystrokes[0]?.id ?? null);
  const [newKey, setNewKey] = useState("");
  const [simLog, setSimLog] = useState<string[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [autoitInstalled, setAutoitInstalled] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);

  // Keep latest keystrokes in ref so the event listener doesn't go stale
  const keystrokesRef = useRef(keystrokes);
  useEffect(() => { keystrokesRef.current = keystrokes; }, [keystrokes]);

  useEffect(() => {
    invoke<boolean>("check_autoit_installed")
      .then((installed) => setAutoitInstalled(installed))
      .catch(() => setAutoitInstalled(false));
  }, []);

  // Listen to TikTok events and fire matching keystrokes
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<TikTokEvent>("rs-tiktok-event", async (event) => {
      const { type, giftId } = event.payload;
      for (const cfg of keystrokesRef.current) {
        if (!cfg.enabled) continue;
        if (cfg.trigger !== type) continue;
        if (type === "gift" && cfg.giftFilter && cfg.giftFilter !== giftId) continue;
        if (cfg.keys.length === 0) continue;
        try {
          await invoke("execute_keystroke", {
            keys: cfg.keys,
            repeatCount: cfg.repeatCount,
            delayMs: cfg.delayMs,
          });
        } catch (e) {
          console.error("[keystroke] error ejecutando:", e);
        }
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const cfg = keystrokes.find((c) => c.id === selected);
  const selectedGift = cfg?.trigger === "gift" ? getGiftById(cfg.giftFilter) : null;

  function updateCfg(patch: Partial<typeof cfg>) {
    if (!cfg) return;
    updateKeystroke(cfg.id, patch as never);
  }

  function handleNew() {
    const id = `ks${Date.now()}`;
    addKeystroke({ id, name: "Nuevo Keystroke", trigger: "gift", giftFilter: "", keys: [], repeatCount: 1, delayMs: 0, enabled: true });
    setSelected(id);
    setSimLog([]);
  }

  function handleDelete() {
    if (!cfg) return;
    const idx = keystrokes.findIndex((k) => k.id === cfg.id);
    deleteKeystroke(cfg.id);
    const remaining = keystrokes.filter((k) => k.id !== cfg.id);
    setSelected(remaining[Math.max(0, idx - 1)]?.id ?? null);
    setSimLog([]);
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
      logs.push(`Esperando ${delayBeforeMs / 1000}s antes de ejecutar...`);
      setSimLog([...logs]);
      await new Promise((r) => setTimeout(r, delayBeforeMs));
    }

    logs.push(`Ejecutando "${cfg.name}"`);
    setSimLog([...logs]);

    if (autoitInstalled && cfg.keys.length > 0) {
      // Real keystroke execution via AutoIt
      try {
        await invoke("execute_keystroke", {
          keys: cfg.keys,
          repeatCount: cfg.repeatCount,
          delayMs: cfg.delayMs,
        });
        for (const key of cfg.keys) {
          logs.push(`  Pulsar: ${key}`);
        }
        logs.push("  AutoIt: secuencia enviada al sistema operativo");
      } catch (e) {
        logs.push(`  AutoIt error: ${String(e)}`);
      }
      setSimLog([...logs]);
    } else {
      // Visual simulation only
      for (let rep = 0; rep < cfg.repeatCount; rep++) {
        for (const key of cfg.keys) {
          await new Promise((r) => setTimeout(r, Math.max(cfg.delayMs, 80)));
          logs.push(`  Pulsar: ${key}`);
          setSimLog([...logs]);
        }
        if (cfg.repeatCount > 1 && rep < cfg.repeatCount - 1) {
          await new Promise((r) => setTimeout(r, cfg.delayMs));
          logs.push(`  Delay entre repeticiones: ${cfg.delayMs}ms`);
          setSimLog([...logs]);
        }
      }
    }

    logs.push(autoitInstalled ? "Secuencia completada" : "Simulación completada · Safe Action Mode ON");
    setSimLog([...logs]);
    setSimRunning(false);
  }

  return (
    <div className="keystroke-workspace">
      <aside className="keystroke-list-panel">
        <div className="keystroke-list-head">
          <span>KEYSTROKE</span>
          <button className="module-green-button module-small-button" onClick={handleNew}>+ Nuevo</button>
        </div>

        <div className="keystroke-list-scroll">
          {keystrokes.map((c) => {
            const trig = TRIGGERS.find((t) => t.id === c.trigger);
            const active = selected === c.id;
            return (
              <button
                key={c.id}
                className={`keystroke-list-item ${active ? "active" : ""} ${!c.enabled ? "disabled" : ""}`}
                onClick={() => { setSelected(c.id); setSimLog([]); }}
              >
                <span className="keystroke-item-icon">
                  {c.trigger === "gift"
                    ? <GiftIcon giftId={c.giftFilter || undefined} size={30} />
                    : <EventIcon type={trig?.id ?? "gift"} size={28} />}
                </span>
                <span className="keystroke-item-copy">
                  <strong>{c.name}</strong>
                  <small>{c.keys.join(" → ")} · ×{c.repeatCount}</small>
                </span>
                <span
                  role="switch"
                  aria-checked={c.enabled}
                  className={`module-toggle ${c.enabled ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); updateKeystroke(c.id, { enabled: !c.enabled }); }}
                >
                  <span />
                </span>
                <span className="keystroke-menu"><UIIcon name="more" size={17} /></span>
              </button>
            );
          })}
        </div>
      </aside>

      {!cfg ? (
        <div className="keystroke-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <span className="keystroke-empty-icon"><UIIcon name="keyboard" size={30} /></span>
          <p>Selecciona un KeyStroke para editarlo</p>
        </div>
      ) : (
        <div className="keystroke-editor">
          {!autoitInstalled && (
            <div className="autoit-banner">
              <span className="autoit-icon"><UIIcon name="warning" size={18} /></span>
              <div>
                <strong>AutoIt no detectado</strong>
                <span>KeyStroke requiere AutoIt para ejecutar pulsaciones reales en el sistema</span>
              </div>
              <a href="https://www.autoitscript.com/files/autoit3/autoit-v3-setup.zip" target="_blank" rel="noreferrer" className="autoit-button">
                <UIIcon name="download" size={14} /> Descargar AutoIt
              </a>
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
                    <EventIcon type={t.id} size={16} state={active ? "selected" : "default"} />{t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {cfg.trigger === "gift" && (
            <div className="gift-simulation-row">
              <section className="gift-selected-card">
                <div className="gift-selected-title">Regalo seleccionado</div>
                <div className="gift-selected-content">
                  <div className="gift-selected-image">
                    <GiftIcon giftId={cfg.giftFilter || undefined} size={64} />
                  </div>
                  <div className="gift-selected-info">
                    <strong>{selectedGift?.name ?? "Ningún regalo"}</strong>
                    {selectedGift ? (
                      <span className="gift-selected-coins"><span>●</span> {selectedGift.coins} coin{selectedGift.coins === 1 ? "" : "s"}</span>
                    ) : (
                      <span className="gift-selected-coins">Cualquier regalo</span>
                    )}
                    <small>Regalo de TikTok</small>
                    <button className="gift-change-button" onClick={() => setShowGiftPicker(true)}><GiftIcon size={16} /> Cambiar regalo</button>
                  </div>
                </div>
                {showGiftPicker && (
                  <GiftPickerModal
                    selectedId={cfg.giftFilter}
                    onSelect={(gift: GiftItem) => { updateCfg({ giftFilter: gift.id, name: cfg.name || gift.name }); setShowGiftPicker(false); }}
                    onClose={() => setShowGiftPicker(false)}
                  />
                )}
              </section>

              <section className="simulation-card simulation-card-inline">
                <div className="simulation-title-row">
                  <span>Simulación de evento</span>
                  <span className="simulation-help">?</span>
                </div>
                <p className="simulation-description">Prueba la secuencia sin esperar un evento real.</p>
                <div className="simulation-buttons">
                  <button className="module-green-button simulation-run" onClick={() => runSim(0)} disabled={simRunning}><UIIcon name="play" size={13} /> Simular evento ahora</button>
                  <button className="module-ghost-button simulation-run" onClick={() => runSim(5000)} disabled={simRunning}><UIIcon name="clock" size={14} /> Ejecutar en 5s</button>
                </div>
                <div className="simulation-log">
                  {simLog.length === 0 && !simRunning && <span>{autoitInstalled ? "Pulsa un botón — se ejecutarán teclas reales via AutoIt." : "Safe Action Mode ON — no se pulsarán teclas reales. Instala AutoIt para ejecución real."}</span>}
                  {simLog.map((line, i) => <div key={i} className={line.startsWith("Secuencia") || line.startsWith("Simulación") ? "log-success" : line.startsWith("Esperando") ? "log-warning" : line.includes("error") ? "log-error" : ""}>{line}</div>)}
                  {simRunning && <div className="log-warning">Procesando...</div>}
                </div>
              </section>
            </div>
          )}

          <Section title="Secuencia de teclas">
            <div className="key-chips">
              {cfg.keys.map((k, i) => (
                <span key={i} className="key-chip">
                  <span className="keycap-label">{k}</span>
                  <button aria-label={`Quitar ${k}`} onClick={() => removeKey(i)}><UIIcon name="x" size={11} /></button>
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

          {cfg.trigger !== "gift" && (
            <Section title="Simulación">
              <div className="simulation-card">
                <div className="simulation-buttons">
                  <button className="module-green-button simulation-run" onClick={() => runSim(0)} disabled={simRunning}><UIIcon name="play" size={13} /> Ejecutar ahora</button>
                  <button className="module-ghost-button simulation-run" onClick={() => runSim(5000)} disabled={simRunning}><UIIcon name="clock" size={14} /> Ejecutar en 5s</button>
                </div>
                <div className="simulation-log">
                  {simLog.length === 0 && !simRunning && <span>{autoitInstalled ? "Pulsa un botón — se ejecutarán teclas reales via AutoIt." : "Safe Action Mode ON — no se pulsarán teclas reales. Instala AutoIt para ejecución real."}</span>}
                  {simLog.map((line, i) => <div key={i} className={line.startsWith("Secuencia") || line.startsWith("Simulación") ? "log-success" : line.startsWith("Esperando") ? "log-warning" : line.includes("error") ? "log-error" : ""}>{line}</div>)}
                  {simRunning && <div className="log-warning">Procesando...</div>}
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
