import { useState, useEffect, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EventIcon, GiftIcon, type EventIconType } from "../../components/icons/EventIcon";
import { UIIcon } from "../../components/icons";
import GiftPickerModal, { type GiftItem } from "../../components/GiftPickerModal";
import { useActionsStore, type MediaType } from "../../stores/actions.store";

interface TikTokEvent {
  type: string;
  giftId?: string;
  username?: string;
}

const TRIGGERS: { id: EventIconType; label: string }[] = [
  { id: "gift", label: "Regalo" },
  { id: "like", label: "Like" },
  { id: "follow", label: "Follow" },
  { id: "comment", label: "Comentario" },
  { id: "share", label: "Compartida" },
  { id: "member", label: "Nuevo miembro" },
  { id: "superfan", label: "Super Fan" },
];

const MEDIA_TYPES: { id: MediaType; label: string; icon: "image" | "audio" | "sparkles" | "gift" }[] = [
  { id: "image", label: "Imagen", icon: "image" },
  { id: "audio", label: "Audio", icon: "audio" },
  { id: "animation", label: "Animación", icon: "sparkles" },
  { id: "gift_overlay", label: "Overlay regalo", icon: "gift" },
];

export default function MediasPage() {
  const { medias, updateMedia, addMedia, deleteMedia } = useActionsStore();
  const [selected, setSelected] = useState<string | null>(medias[0]?.id ?? null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);

  const cfg = medias.find((m) => m.id === selected);

  function updateCfg(patch: Partial<typeof cfg>) {
    if (!cfg) return;
    updateMedia(cfg.id, patch as never);
  }

  function handleNew() {
    const id = `m${Date.now()}`;
    addMedia({ id, name: "Nuevo Medio", trigger: "gift", giftFilter: "", mediaType: "animation", url: "", durationMs: 3000, enabled: true });
    setSelected(id);
  }

  function handleDelete() {
    if (!cfg) return;
    const idx = medias.findIndex((m) => m.id === cfg.id);
    deleteMedia(cfg.id);
    const remaining = medias.filter((m) => m.id !== cfg.id);
    setSelected(remaining[Math.max(0, idx - 1)]?.id ?? null);
  }

  // Keep ref updated so event listener always sees latest medias
  const mediasRef = useRef(medias);
  useEffect(() => { mediasRef.current = medias; }, [medias]);

  // Listen to TikTok events and trigger matching media overlays
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<TikTokEvent>("rs-tiktok-event", async (event) => {
      const { type, giftId } = event.payload;
      for (const m of mediasRef.current) {
        if (!m.enabled || !m.url) continue;
        if (m.trigger !== type) continue;
        if (type === "gift" && m.giftFilter && m.giftFilter !== giftId) continue;
        // Extract overlay id from URL path (last segment)
        const overlayId = m.url.split("/").pop() ?? m.url;
        try {
          await invoke("trigger_media_overlay", {
            overlayId,
            payload: { action: "show", durationMs: m.durationMs, mediaType: m.mediaType, url: m.url },
          });
        } catch (e) {
          console.error("[media] trigger_media_overlay error:", e);
        }
        break; // one overlay per event batch is enough
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).catch(() => {});
  }

  function openInBrowser(url: string) {
    if (!url) return;
    invoke("open_in_browser", { url }).catch(console.error);
  }

  return (
    <div className="keystroke-workspace">
      {/* Lista izquierda */}
      <aside className="keystroke-list-panel">
        <div className="keystroke-list-head">
          <span>MEDIOS Y OVERLAYS</span>
          <button className="module-green-button module-small-button" onClick={handleNew}>+ Nuevo</button>
        </div>

        <div className="keystroke-list-scroll">
          {medias.map((m) => {
            const trig = TRIGGERS.find((t) => t.id === m.trigger);
            const mt = MEDIA_TYPES.find((t) => t.id === m.mediaType);
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                className={`keystroke-list-item ${active ? "active" : ""} ${!m.enabled ? "disabled" : ""}`}
                onClick={() => setSelected(m.id)}
              >
                <span className="keystroke-item-icon">
                  <EventIcon type={trig?.id ?? "gift"} size={28} />
                </span>
                <span className="keystroke-item-copy">
                  <strong>{m.name}</strong>
                  <small><UIIcon name={mt?.icon ?? "sparkles"} size={11} /> {mt?.label} · {m.durationMs / 1000}s</small>
                </span>
                <span
                  role="switch"
                  aria-checked={m.enabled}
                  className={`module-toggle ${m.enabled ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); updateMedia(m.id, { enabled: !m.enabled }); }}
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
      {!cfg ? (
        <div className="keystroke-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <span className="media-empty-icon"><UIIcon name="film" size={30} /></span>
          <p style={{ color: "var(--rs-text-muted)", fontSize: 14 }}>Selecciona un medio para editarlo</p>
        </div>
      ) : (
        <div className="keystroke-editor">
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
            <Section title="Filtro de regalo">
              <div className="gift-filter-row">
                <button
                  className={`module-input gift-filter ${cfg.giftFilter ? "filled" : ""}`}
                  onClick={() => setShowGiftPicker(true)}
                >
                  {cfg.giftFilter
                    ? <><GiftIcon giftId={cfg.giftFilter} size={22} /> {cfg.giftFilter}</>
                    : "Seleccionar regalo..."}
                </button>
                {cfg.giftFilter && (
                  <button className="icon-danger-button" onClick={() => updateCfg({ giftFilter: "" })} title="Quitar filtro">
                    <UIIcon name="x" size={14} />
                  </button>
                )}
                <button className="module-green-button gift-action-button" onClick={() => setShowGiftPicker(true)}>
                  <GiftIcon size={16} /> Elegir
                </button>
              </div>
              <p className="module-help">Vacío = se activa con cualquier regalo</p>
              {showGiftPicker && (
                <GiftPickerModal
                  selectedId={cfg.giftFilter}
                  onSelect={(gift: GiftItem) => { updateCfg({ giftFilter: gift.id }); setShowGiftPicker(false); }}
                  onClose={() => setShowGiftPicker(false)}
                />
              )}
            </Section>
          )}

          <Section title="Tipo de medio">
            <div className="trigger-row">
              {MEDIA_TYPES.map((t) => {
                const active = cfg.mediaType === t.id;
                return (
                  <button key={t.id} className={`trigger-chip ${active ? "active" : ""}`} onClick={() => updateCfg({ mediaType: t.id })}>
                    <UIIcon name={t.icon} size={14} /> {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="URL del overlay (Browser Source)">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="module-input"
                value={cfg.url}
                onChange={(e) => updateCfg({ url: e.target.value })}
                placeholder="http://localhost:47820/overlay/timer.html"
                style={{ flex: 1, fontFamily: "monospace" }}
              />
              <button className="module-ghost-button" onClick={() => copyUrl(cfg.url)}>
                <UIIcon name="copy" size={14} /> Copiar
              </button>
            </div>
            <p className="module-help">Pega la URL del overlay desde el módulo Overlays. ReactStream enviará la señal cuando se dispare el trigger.</p>
          </Section>

          <Section title="Duración de visualización">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                className="module-input"
                type="number" min={500} max={30000}
                value={cfg.durationMs}
                onChange={(e) => updateCfg({ durationMs: Number(e.target.value) })}
                style={{ width: 110 }}
              />
              <span style={{ fontSize: 12, color: "var(--rs-text-secondary)" }}>ms · {(cfg.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </Section>

          <Section title="Estado">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                role="switch"
                aria-checked={cfg.enabled}
                className={`module-toggle ${cfg.enabled ? "on" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => updateCfg({ enabled: !cfg.enabled })}
              >
                <span />
              </span>
              <span style={{ fontSize: 13, color: cfg.enabled ? "var(--rs-green)" : "var(--rs-text-muted)" }}>
                {cfg.enabled ? "Activo" : "Desactivado"}
              </span>
            </div>
          </Section>

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
