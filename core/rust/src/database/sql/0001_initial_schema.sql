-- Migración 0001 — Esquema inicial (Sección 22 del documento maestro).
-- No editar retroactivamente: cualquier cambio de esquema va en una nueva
-- migración (Regla #75: cambios de contratos formales + pruebas).

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 10,
    global_cooldown_ms INTEGER NOT NULL DEFAULT 0,
    per_user_cooldown_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE automation_conditions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL,
    logic TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (automation_id)
        REFERENCES automations(id)
        ON DELETE CASCADE
);

CREATE TABLE automation_actions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    repeat_count INTEGER NOT NULL DEFAULT 1,
    repeat_interval_ms INTEGER NOT NULL DEFAULT 0,
    config_json TEXT NOT NULL,
    FOREIGN KEY (automation_id)
        REFERENCES automations(id)
        ON DELETE CASCADE
);

CREATE TABLE sounds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    volume INTEGER NOT NULL DEFAULT 100,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE TABLE overlays (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    config_json TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE gift_catalog (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    coins INTEGER NOT NULL,
    image_url TEXT,
    local_image_path TEXT,
    region TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (id, region)
);

CREATE TABLE live_sessions (
    id TEXT PRIMARY KEY,
    tiktok_user_id TEXT NOT NULL,
    tiktok_username TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    total_likes INTEGER NOT NULL DEFAULT 0,
    total_coins INTEGER NOT NULL DEFAULT 0,
    total_gifts INTEGER NOT NULL DEFAULT 0,
    total_follows INTEGER NOT NULL DEFAULT 0,
    total_shares INTEGER NOT NULL DEFAULT 0,
    total_comments INTEGER NOT NULL DEFAULT 0,
    max_viewers INTEGER NOT NULL DEFAULT 0,
    best_gift_id TEXT,
    best_gift_coins INTEGER,
    best_gift_sender_id TEXT,
    best_gift_sender_name TEXT
);

CREATE TABLE live_session_donors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    coins INTEGER NOT NULL,
    FOREIGN KEY (session_id)
        REFERENCES live_sessions(id)
        ON DELETE CASCADE
);

CREATE TABLE live_session_tappers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    likes INTEGER NOT NULL,
    FOREIGN KEY (session_id)
        REFERENCES live_sessions(id)
        ON DELETE CASCADE
);

CREATE TABLE license_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    signed_payload TEXT NOT NULL,
    last_validation_at INTEGER NOT NULL
);

CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    level TEXT NOT NULL,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    context_json TEXT
);

CREATE INDEX idx_automations_enabled ON automations(enabled);
CREATE INDEX idx_automation_conditions_automation_id ON automation_conditions(automation_id);
CREATE INDEX idx_automation_actions_automation_id ON automation_actions(automation_id);
CREATE INDEX idx_gift_catalog_id ON gift_catalog(id);
CREATE INDEX idx_gift_catalog_region ON gift_catalog(region);
CREATE INDEX idx_live_sessions_started_at ON live_sessions(started_at);
CREATE INDEX idx_live_sessions_tiktok_user_id ON live_sessions(tiktok_user_id);
CREATE INDEX idx_live_session_donors_session_id ON live_session_donors(session_id);
CREATE INDEX idx_live_session_donors_user_id ON live_session_donors(user_id);
CREATE INDEX idx_live_session_tappers_session_id ON live_session_tappers(session_id);
CREATE INDEX idx_live_session_tappers_user_id ON live_session_tappers(user_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_level ON logs(level);
