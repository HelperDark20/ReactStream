import { useState, useEffect, useRef, useCallback, type ReactNode, type PointerEvent, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EventIcon, GiftIcon, type EventIconType, MusicIcon, SoundPlayerIcon, VolumeFilledIcon, UIIcon } from "../components/icons";
import GiftPickerModal, { type GiftItem } from "../components/GiftPickerModal";
import { useActionsStore } from "../stores/actions.store";
import background from "../assets/reactstream-background.svg";
import soundPlayButton from "../assets/sound-play-button.svg";
import soundPauseButton from "../assets/sound-pause-button.svg";
import soundFileIcon from "../assets/sound-file-icon.svg";
import soundWaves from "../assets/reactstream-sound-waves-exact.svg";
import "./SoundsPage.css";

interface TikTokEvent {
  type: string;
  giftId?: string;
  username?: string;
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

type Filter = "all" | "active" | "inactive";

function formatDur(secs: number | undefined): string {
  if (!secs || !isFinite(secs)) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m17 3 4 4-13 13H4v-4L17 3z" />
    </svg>
  );
}

function makeNoisyWaveform(): number[] {
  return Array.from({ length: 80 }, (_, i) => {
    const t = i / 80;
    return Math.max(0.08, 0.18 + Math.sin(t * Math.PI * 7) * 0.22 + Math.sin(t * Math.PI * 13) * 0.14 + (Math.random() - 0.5) * 0.18);
  });
}

export default function SoundsPage() {
  const { sounds, updateSound, addSound, deleteSound } = useActionsStore();
  const [selected, setSelected] = useState<string | null>(sounds[0]?.id ?? null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingName, setEditingName] = useState(false);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [waveformData, setWaveformData] = useState<number[]>(() => makeNoisyWaveform());
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [savedPulse, setSavedPulse] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const seekingRef = useRef(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const cfg = sounds.find((s) => s.id === selected);

  const soundsRef = useRef(sounds);
  useEffect(() => { soundsRef.current = sounds; }, [sounds]);

  const filteredSounds = sounds.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.filename.toLowerCase().includes(q);
    const matchFilter =
      filter === "all" ||
      (filter === "active" && s.enabled) ||
      (filter === "inactive" && !s.enabled);
    return matchSearch && matchFilter;
  });

  const activeCnt = sounds.filter((s) => s.enabled).length;
  const inactiveCnt = sounds.filter((s) => !s.enabled).length;

  // TikTok event listener — identical to original
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<TikTokEvent>("rs-tiktok-event", (event) => {
      const { type, giftId } = event.payload;
      for (const s of soundsRef.current) {
        if (!s.enabled || !s.filePath) continue;
        if (s.trigger !== type) continue;
        if (type === "gift" && s.giftFilter && s.giftFilter !== giftId) continue;
        const url = convertFileSrc(s.filePath);
        const audio = new Audio(url);
        audio.volume = s.volume / 100;
        audio.play().catch(console.error);
        break;
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Load duration for a sound by its filePath
  const loadDuration = useCallback((soundId: string, filePath: string) => {
    const url = convertFileSrc(filePath);
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => {
      if (isFinite(a.duration)) {
        setDurations((prev) => ({ ...prev, [soundId]: a.duration }));
      }
    });
    a.src = url;
  }, []);

  useEffect(() => {
    sounds.forEach((s) => {
      if (s.filePath && durations[s.id] == null) loadDuration(s.id, s.filePath);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sounds]);

  // Load waveform when selected sound changes
  useEffect(() => {
    setCurrentTime(0);
    if (!cfg?.filePath) {
      setWaveformData(makeNoisyWaveform());
      setAudioDuration(durations[cfg?.id ?? ""] ?? 0);
      return;
    }
    const url = convertFileSrc(cfg.filePath);
    let cancelled = false;
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => new AudioContext().decodeAudioData(buf))
      .then((decoded) => {
        if (cancelled) return;
        setAudioDuration(decoded.duration);
        const ch = decoded.getChannelData(0);
        const N = 80;
        const block = Math.floor(ch.length / N);
        const bars: number[] = [];
        for (let i = 0; i < N; i++) {
          let rms = 0;
          for (let j = 0; j < block; j++) rms += (ch[i * block + j] ?? 0) ** 2;
          bars.push(Math.sqrt(rms / block));
        }
        const peak = Math.max(...bars, 0.001);
        setWaveformData(bars.map((b) => b / peak));
      })
      .catch(() => {
        if (!cancelled) setWaveformData(makeNoisyWaveform());
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.id, cfg?.filePath]);

  // Draw waveform canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 400;
    const H = canvas.offsetHeight || 80;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const data = waveformData;
    const n = data.length;
    const progress = audioDuration > 0 ? currentTime / audioDuration : 0;
    const barW = W / n;
    const gap = 1.5;

    for (let i = 0; i < n; i++) {
      const val = data[i] ?? 0.3;
      const barH = Math.max(3, val * H * 0.88);
      const x = i * barW;
      const y = (H - barH) / 2;
      const isPlayed = i / n <= progress;
      ctx.fillStyle = isPlayed ? "#39ff14" : "rgba(57,255,20,0.28)";
      const bw = Math.max(1, barW - gap);
      const bx = x + gap / 2;
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(bx, y, bw, barH, Math.min(2, bw * 0.45));
        ctx.fill();
      } else {
        ctx.fillRect(bx, y, bw, barH);
      }
    }
  }, [waveformData, currentTime, audioDuration]);

  // RAF loop to update currentTime during playback
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (playing !== cfg?.id || !audioRef.current) return;
    const audio = audioRef.current;
    const tick = () => {
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, cfg?.id]);

  function updateCfg(patch: Partial<typeof cfg>) {
    if (!cfg) return;
    updateSound(cfg.id, patch as never);
  }

  function handleNew() {
    const id = `snd${Date.now()}`;
    addSound({ id, name: "Nuevo Sonido", filename: "nuevo.mp3", volume: 80, enabled: true, trigger: "gift", giftFilter: "" });
    setSelected(id);
    setEditingName(true);
  }

  function handleDelete() {
    if (!cfg) return;
    const idx = sounds.findIndex((s) => s.id === cfg.id);
    deleteSound(cfg.id);
    const remaining = sounds.filter((s) => s.id !== cfg.id);
    setSelected(remaining[Math.max(0, idx - 1)]?.id ?? null);
  }

  function handleDuplicate() {
    if (!cfg) return;
    const id = `snd${Date.now()}`;
    addSound({ ...cfg, id, name: `${cfg.name} (copia)` });
    setSelected(id);
  }

  function handleSave() {
    setSavedPulse(true);
    setTimeout(() => setSavedPulse(false), 1200);
  }

  function seekToClientX(clientX: number) {
    const track = progressTrackRef.current;
    const audio = audioRef.current;
    if (!track || !audio || audioDuration <= 0) return;

    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;

    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const time = ratio * audioDuration;

    audio.currentTime = time;
    setCurrentTime(time);
  }

  function handleProgressPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!audioRef.current || audioDuration <= 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekingRef.current = true;
    setIsSeeking(true);
    seekToClientX(e.clientX);
  }

  function handleProgressPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!seekingRef.current) return;
    seekToClientX(e.clientX);
  }

  function finishProgressSeek(e: PointerEvent<HTMLDivElement>) {
    if (!seekingRef.current) return;
    seekToClientX(e.clientX);
    seekingRef.current = false;
    setIsSeeking(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleProgressKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || audioDuration <= 0) return;

    let nextTime: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
        nextTime = audio.currentTime - 5;
        break;
      case "ArrowRight":
        nextTime = audio.currentTime + 5;
        break;
      case "Home":
        nextTime = 0;
        break;
      case "End":
        nextTime = audioDuration;
        break;
      default:
        return;
    }

    e.preventDefault();
    const time = Math.min(audioDuration, Math.max(0, nextTime));
    audio.currentTime = time;
    setCurrentTime(time);
  }

  function previewSound(s: typeof sounds[number] | undefined) {
    if (!s) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playing === s.id) {
      setPlaying(null);
      setCurrentTime(0);
      return;
    }
    if (!s.filePath) {
      setPlaying(s.id);
      setTimeout(() => setPlaying(null), 1500);
      return;
    }
    setPlaying(s.id);
    setCurrentTime(0);
    const url = convertFileSrc(s.filePath);
    const audio = new Audio(url);
    audio.volume = s.volume / 100;
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => {
      if (isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
        setDurations((prev) => ({ ...prev, [s.id]: audio.duration }));
      }
    });
    audio.play().catch(console.error);
    audio.addEventListener("ended", () => {
      setPlaying(null);
      setCurrentTime(0);
      audioRef.current = null;
    });
  }

  async function handlePickFile() {
    if (!cfg) return;
    try {
      const path = await invoke<string | null>("pick_audio_file");
      if (path) {
        const filename = path.split(/[/\\]/).pop() ?? path;
        updateCfg({ filename, filePath: path });
        loadDuration(cfg.id, path);
      }
    } catch (e) {
      console.error("[sounds] pick_audio_file error:", e);
    }
  }

  const progressPct = audioDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / audioDuration) * 100))
    : 0;

  return (
    <section className="actions-module-shell">
      <img className="actions-module-background" src={background} alt="" draggable={false} />

      <header className="actions-module-header">
        <div className="actions-module-title-row">
          <MusicIcon className="actions-module-title-icon" />
          <div>
            <h1>Sonidos</h1>
            <p>Reproduce efectos de sonido automáticamente durante tu LIVE</p>
          </div>
        </div>
      </header>

      <div className="actions-module-card">
        <div className="actions-module-content">
          <div className="snd-workspace">

            {/* ── Left panel ── */}
            <aside className="snd-panel">
              <div className="snd-panel-head">
                <span className="snd-panel-title">SONIDOS ({sounds.length})</span>
                <button className="snd-new-btn" onClick={handleNew}>
                  <UIIcon name="plus" size={11} />
                  Nuevo
                </button>
              </div>

              <div className="snd-search-wrap">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="snd-search-icon">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  className="snd-search-input"
                  placeholder="Buscar sonidos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="snd-filters">
                <button className={`snd-filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                  Todos ({sounds.length})
                </button>
                <button className={`snd-filter-btn ${filter === "active" ? "active" : ""}`} onClick={() => setFilter("active")}>
                  Activos ({activeCnt})
                </button>
                <button className={`snd-filter-btn ${filter === "inactive" ? "active" : ""}`} onClick={() => setFilter("inactive")}>
                  Inactivos ({inactiveCnt})
                </button>
              </div>

              <div className="snd-list">
                {filteredSounds.length === 0 ? (
                  <div className="snd-list-empty">No hay sonidos que coincidan</div>
                ) : (
                  filteredSounds.map((s) => {
                    const isActive = selected === s.id;
                    const dur = durations[s.id];
                    return (
                      <button
                        key={s.id}
                        className={`snd-item ${isActive ? "active" : ""} ${!s.enabled ? "disabled" : ""}`}
                        onClick={() => setSelected(s.id)}
                      >
                        <span
                          className={`snd-item-play ${playing === s.id ? "playing" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); previewSound(s); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); previewSound(s); } }}
                          aria-label={playing === s.id ? "Pausar" : "Reproducir"}
                        >
                          <img
                            src={playing === s.id ? soundPauseButton : soundPlayButton}
                            alt=""
                            draggable={false}
                            aria-hidden="true"
                          />
                        </span>

                        <div className="snd-item-info">
                          <strong className="snd-item-name">{s.name}</strong>
                          <span className="snd-item-file">
                            <img
                              src={soundFileIcon}
                              alt=""
                              aria-hidden="true"
                              draggable={false}
                              className="snd-item-file-icon"
                            />
                            {s.filename}
                          </span>
                          <span className="snd-item-dur">
                            {dur != null && dur > 0 ? formatDur(dur) : "--:--"}
                          </span>
                        </div>

                        <div className="snd-item-right">
                          <span
                            role="switch"
                            aria-checked={s.enabled}
                            className={`module-toggle ${s.enabled ? "on" : ""}`}
                            onClick={(e) => { e.stopPropagation(); updateSound(s.id, { enabled: !s.enabled }); }}
                          >
                            <span />
                          </span>
                          <span className="snd-item-more">
                            <UIIcon name="more" size={14} />
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* ── Right editor ── */}
            {!cfg ? (
              <div className="snd-editor-empty">
                <div className="snd-editor-empty-icon">
                  <UIIcon name="audio" size={28} />
                </div>
                <p>Selecciona un sonido para configurarlo</p>
                <button className="module-green-button" style={{ marginTop: 4 }} onClick={handleNew}>
                  + Agregar sonido
                </button>
              </div>
            ) : (
              <div className="snd-editor">

                {/* Header actions stay outside the player capsule */}
                <div className="snd-editor-top">
                  <div className="snd-editor-name-area" aria-hidden="true" />
                  <div className="snd-editor-top-actions">
                    <button className="snd-dup-btn" onClick={handleDuplicate}>
                      <UIIcon name="copy" size={13} />
                      Duplicar
                    </button>
                    <button className="snd-del-btn-top" onClick={handleDelete}>
                      <UIIcon name="trash" size={13} />
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Player capsule: title + player + file/state */}
                <div className="snd-preview-card">
                  <div className="snd-preview-header">
                    <div className="snd-preview-name-area">
                      {editingName ? (
                        <input
                          className="snd-name-input"
                          value={cfg.name}
                          onChange={(e) => updateCfg({ name: e.target.value })}
                          onBlur={() => setEditingName(false)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                          autoFocus
                        />
                      ) : (
                        <>
                          <h2 className="snd-editor-title">{cfg.name}</h2>
                          <button className="snd-edit-name-btn" onClick={() => setEditingName(true)} title="Editar nombre">
                            <PencilIcon size={12} />
                          </button>
                        </>
                      )}
                    </div>
                    <p className="snd-preview-subtitle">Reproduce un sonido cuando se active el trigger seleccionado</p>
                  </div>

                  <div className="snd-preview-body">
                    <div className="snd-preview-art snd-sub-capsule">
                      <img
                        src={soundWaves}
                        alt=""
                        aria-hidden="true"
                        className="snd-preview-art-waves"
                      />
                      <SoundPlayerIcon className="snd-preview-art-icon" />
                    </div>

                    <div className="snd-waveform-capsule snd-sub-capsule">
                      <canvas
                        ref={waveformCanvasRef}
                        className="snd-waveform-canvas"
                        style={{ width: "100%", height: "60px" }}
                      />
                      <div
                        ref={progressTrackRef}
                        className={`snd-progress-track ${isSeeking ? "is-seeking" : ""}`}
                        role="slider"
                        aria-label="Posición del audio"
                        aria-valuemin={0}
                        aria-valuemax={audioDuration}
                        aria-valuenow={Math.min(audioDuration, Math.max(0, currentTime))}
                        aria-valuetext={`${formatTime(currentTime)} de ${formatTime(audioDuration)}`}
                        tabIndex={0}
                        onPointerDown={handleProgressPointerDown}
                        onPointerMove={handleProgressPointerMove}
                        onPointerUp={finishProgressSeek}
                        onPointerCancel={finishProgressSeek}
                        onKeyDown={handleProgressKeyDown}
                      >
                        <div className="snd-progress-fill" style={{ width: `${progressPct}%` }} />
                        <span
                          className="snd-progress-thumb"
                          style={{ left: `${progressPct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="snd-time-row">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(audioDuration || durations[cfg.id] || 0)}</span>
                      </div>
                    </div>

                    <button
                      className={`snd-play-main ${playing === cfg.id ? "playing" : ""}`}
                      onClick={() => previewSound(cfg)}
                      aria-label={playing === cfg.id ? "Pausar sonido" : "Reproducir sonido"}
                    >
                      <img
                        src={playing === cfg.id ? soundPauseButton : soundPlayButton}
                        alt=""
                        aria-hidden="true"
                        className="snd-play-main-icon"
                      />
                    </button>
                  </div>

                  <div className="snd-vol-row">
                    <VolumeFilledIcon size={30} className="snd-volume-icon" style={{ color: "#fff", flexShrink: 0 }} />
                    <div className="snd-volume-slider-wrap" style={{ "--volume-percent": `${cfg.volume}%` } as React.CSSProperties}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={cfg.volume}
                        className="sound-slider"
                        onChange={(e) => {
                        const v = Number(e.target.value);
                        updateCfg({ volume: v });
                          if (audioRef.current) audioRef.current.volume = v / 100;
                        }}
                      />
                    </div>
                    <span className="snd-vol-label">{cfg.volume}%</span>
                  </div>

                  <div className="snd-player-meta">
                    <div className="snd-player-file snd-sub-capsule">
                      <label className="snd-info-label">Archivo de audio</label>
                      <div className="snd-player-file-row">
                        <div className="module-input sound-filename snd-player-filename">
                          {cfg.filename || "Sin archivo"}
                        </div>
                        <button className="snd-cambiar-btn" onClick={handlePickFile}>
                          Cambiar
                        </button>
                      </div>
                    </div>

                    <div className="snd-player-state snd-sub-capsule">
                      <label className="snd-info-label">Estado del sonido</label>
                      <div className="snd-player-state-row">
                        <span
                          role="switch"
                          aria-checked={cfg.enabled}
                          className={`module-toggle ${cfg.enabled ? "on" : ""}`}
                          style={{ cursor: "pointer", flexShrink: 0 }}
                          onClick={() => updateCfg({ enabled: !cfg.enabled })}
                        >
                          <span />
                        </span>
                        <span className="snd-player-state-text">
                          {cfg.enabled
                            ? "Activo - suena cuando se dispara el trigger"
                            : "Desactivado - no suena aunque se dispare"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trigger capsule */}
                <div className="snd-trigger-block">
                <SndSection title="TRIGGER - CUÁNDO SUENA ESTE SONIDO">
                  <div className="trigger-row">
                    {TRIGGERS.map((t) => {
                      const active = cfg.trigger === t.id;
                      return (
                        <button
                          key={t.id}
                          className={`trigger-chip ${active ? "active" : ""}`}
                          onClick={() => updateCfg({ trigger: t.id, giftFilter: "" })}
                        >
                          <EventIcon type={t.id} size={16} state={active ? "selected" : "default"} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  {cfg.trigger === "gift" && (
                    <div style={{ marginTop: 10 }}>
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
                          <button
                            className="icon-danger-button"
                            onClick={() => updateCfg({ giftFilter: "" })}
                            title="Quitar filtro"
                          >
                            <UIIcon name="x" size={14} />
                          </button>
                        )}
                        <button className="module-green-button gift-action-button" onClick={() => setShowGiftPicker(true)}>
                          <GiftIcon size={16} /> Elegir
                        </button>
                      </div>
                      <p className="module-help">Vacío = suena con cualquier regalo</p>
                      {showGiftPicker && (
                        <GiftPickerModal
                          selectedId={cfg.giftFilter}
                          onSelect={(gift: GiftItem) => {
                            updateCfg({ giftFilter: gift.id });
                            setShowGiftPicker(false);
                          }}
                          onClose={() => setShowGiftPicker(false)}
                        />
                      )}
                    </div>
                  )}
                </SndSection>

                {/* Bottom actions stay inside the Trigger capsule. */}
                <div className="snd-editor-actions">
                  <button className="snd-test-btn" onClick={() => previewSound(cfg)}>
                    <UIIcon name="play" size={13} />
                    Probar sonido
                  </button>
                  <button
                    className={`snd-save-btn ${savedPulse ? "saved" : ""}`}
                    onClick={handleSave}
                  >
                    <UIIcon name="check" size={13} />
                    Guardar cambios
                  </button>
                </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SndSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="snd-section">
      <div className="snd-section-title">{title}</div>
      {children}
    </div>
  );
}
