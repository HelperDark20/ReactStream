// ReactStream Desktop — Integración Tauri ↔ Core
// Regla #2-3: React nunca ejecuta acciones del sistema ni conecta
// directamente con TikTok — todo pasa por estos comandos hacia el Core.
// Regla #83-84: UI refleja solo el estado confirmado por el Core.

use reactstream_core::{
    clock::ProductionClock,
    event_bus::EventBus,
    logging::{InMemoryLogger, LogEntry, LogLevel, Logger},
    overlays::OverlayEngine,
    rankings::{best_gift::BestGiftEngine, RankingEngine},
    session::SessionManager,
    state::{settings::SettingsManager, StateManager},
    timer::TimerEngine,
    ws_server::WsServer,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};
use uuid::Uuid;

// ============================================================
// TikTok Session (cookies capturadas del WebView de login)
// ============================================================

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TikTokSession {
    pub session_id:    String,
    pub tt_target_idc: String,
    pub username:      String,
    pub display_name:  String,
    pub avatar_url:    String,
    /// Todas las cookies de TikTok como "k1=v1; k2=v2; ..."
    pub cookie_string: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TikTokLoginResult {
    pub success:  bool,
    pub username: Option<String>,
    pub error:    Option<String>,
}

// ============================================================
// Persistencia de sesión TikTok (app_data_dir/tiktok_session.json)
// ============================================================

fn session_file_path() -> Option<std::path::PathBuf> {
    // Usa %APPDATA%\com.reactstream.app\ (o el equivalente del OS)
    let proj = directories::ProjectDirs::from("com", "reactstream", "app")?;
    Some(proj.data_local_dir().join("tiktok_session.json"))
}

fn save_session(session: &TikTokSession) {
    if let Some(path) = session_file_path() {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string(session) {
            let _ = std::fs::write(&path, json);
        }
    }
}

fn load_session() -> Option<TikTokSession> {
    let path = session_file_path()?;
    let json = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&json).ok()
}

// ============================================================
// Estado global del Core (vive en RAM durante toda la sesión)
// ============================================================

pub struct CoreState {
    pub logger:          Arc<InMemoryLogger>,
    pub event_bus:       Arc<EventBus>,
    pub session_mgr:     Arc<SessionManager>,
    pub ranking_mgr:     Arc<RankingEngine>,
    pub best_gift_mgr:   Arc<BestGiftEngine>,
    pub timer_engine:    Mutex<Option<Arc<TimerEngine>>>,
    pub settings_mgr:    Arc<SettingsManager>,
    pub state_mgr:       Arc<StateManager>,
    pub overlay_engine:  Arc<OverlayEngine>,
    pub ws_server:       Arc<WsServer>,
    pub tiktok_username: Mutex<String>,
    pub tiktok_session:  Mutex<Option<TikTokSession>>,
    pub bridge_process:  Mutex<Option<std::process::Child>>,
}

impl CoreState {
    fn new() -> Self {
        let logger       = Arc::new(InMemoryLogger::new());
        let event_bus    = Arc::new(EventBus::new(logger.clone()));
        let session_mgr  = Arc::new(SessionManager::new());
        let ranking_mgr  = Arc::new(RankingEngine::new(10, 10));
        let best_gift_mgr  = Arc::new(BestGiftEngine::new());
        let settings_mgr   = Arc::new(SettingsManager::default());
        let state_mgr      = Arc::new(StateManager::new());
        let overlay_engine = Arc::new(OverlayEngine::new(logger.clone()));
        let ws_server      = Arc::new(WsServer::new(
            event_bus.clone(),
            overlay_engine.clone(),
            logger.clone(),
            session_mgr.clone(),
        ));

        // Conectar motores al Event Bus
        reactstream_core::session::wire_to_event_bus(session_mgr.clone(), &event_bus);
        reactstream_core::rankings::wire_to_event_bus(ranking_mgr.clone(), &event_bus);
        reactstream_core::rankings::best_gift::wire_to_event_bus(best_gift_mgr.clone(), &event_bus);

        Self {
            logger,
            event_bus,
            session_mgr,
            ranking_mgr,
            best_gift_mgr,
            timer_engine:    Mutex::new(None),
            settings_mgr,
            state_mgr,
            overlay_engine,
            ws_server,
            tiktok_username: Mutex::new(
                load_session().as_ref().map(|s| s.username.clone()).unwrap_or_default()
            ),
            tiktok_session:  Mutex::new(load_session()),
            bridge_process:  Mutex::new(None),
        }
    }
}

// ============================================================
// DTOs para React (camelCase, serializable)
// ============================================================

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GiftCatalogItemDto {
    pub id: String,
    pub name: String,
    pub coins: u64,
    pub image_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppStatusDto {
    pub application:         String,
    pub tiktok_connection:   String,
    pub session:             String,
    pub version:             String,
    pub tiktok_username:     String,
    pub tiktok_display_name: String,
    pub tiktok_avatar_url:   String,
    pub tiktok_logged_in:    bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatsDto {
    pub session_id:       String,
    pub total_coins:      u64,
    pub total_likes:      u64,
    pub total_gifts:      u64,
    pub total_follows:    u64,
    pub total_shares:     u64,
    pub total_comments:   u64,
    pub max_viewers:      u64,
    pub current_viewers:  u64,
    pub duration_seconds: u64,
    pub best_gift_name:   Option<String>,
    pub best_gift_coins:  Option<u64>,
    pub best_gift_sender: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimerStateDto {
    pub remaining_seconds: u64,
    pub running: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DonorDto {
    pub user_id:      String,
    pub display_name: String,
    pub avatar_url:   Option<String>,
    pub coins:        u64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TapperDto {
    pub user_id:      String,
    pub display_name: String,
    pub avatar_url:   Option<String>,
    pub likes:        u64,
}

// ============================================================
// Comandos Tauri
// ============================================================

#[tauri::command]
async fn get_status(state: State<'_, CoreState>) -> Result<AppStatusDto, String> {
    let snap       = state.state_mgr.snapshot();
    let username   = state.tiktok_username.lock().unwrap().clone();
    let (logged_in, display_name, avatar_url) = {
        let sess = state.tiktok_session.lock().unwrap();
        match sess.as_ref() {
            Some(s) => (true, s.display_name.clone(), s.avatar_url.clone()),
            None    => (false, String::new(), String::new()),
        }
    };
    Ok(AppStatusDto {
        application:           format!("{:?}", snap.application),
        tiktok_connection:     format!("{:?}", snap.tiktok_connection),
        session:               format!("{:?}", snap.session),
        version:               env!("CARGO_PKG_VERSION").to_string(),
        tiktok_username:       username,
        tiktok_display_name:   display_name,
        tiktok_avatar_url:     avatar_url,
        tiktok_logged_in:      logged_in,
    })
}

#[tauri::command]
async fn connect_tiktok(
    username: String,
    state: State<'_, CoreState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let username = username.trim().to_string();
    if username.is_empty() {
        return Err("El username no puede estar vacío".to_string());
    }

    // Matar bridge anterior si hay uno corriendo (árbol completo en Windows)
    {
        let mut guard = state.bridge_process.lock().unwrap();
        if let Some(mut child) = guard.take() {
            #[cfg(target_os = "windows")]
            {
                let pid = child.id();
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    *state.tiktok_username.lock().unwrap() = username.clone();
    *state.ws_server.session_username.lock().unwrap() = username.clone();

    // Persist username in session file so it survives app restarts
    {
        let mut sess_guard = state.tiktok_session.lock().unwrap();
        if let Some(ref mut sess) = *sess_guard {
            sess.username = username.clone();
            save_session(sess);
        }
    }

    use reactstream_core::contracts::{ApplicationState, TikTokConnectionState};
    state.state_mgr.set_tiktok_connection(TikTokConnectionState::Connecting);
    state.state_mgr.set_application(ApplicationState::Connecting);

    // Leer la sesión TikTok (cookies capturadas en el login WebView)
    let (session_id, target_idc, cookie_string) = {
        let sess = state.tiktok_session.lock().unwrap();
        match sess.as_ref() {
            Some(s) => (s.session_id.clone(), s.tt_target_idc.clone(), s.cookie_string.clone()),
            None    => (String::new(), String::new(), String::new()),
        }
    };

    // Localizar el directorio del bridge. Busca "apps/tiktok-bridge" navegando
    // hacia arriba desde el ejecutable actual (funciona en dev y prod).
    let bridge_dir = if let Ok(p) = std::env::var("REACTSTREAM_BRIDGE_DIR") {
        std::path::PathBuf::from(p)
    } else {
        let exe = std::env::current_exe()
            .map_err(|e| format!("no se pudo obtener el ejecutable: {e}"))?;
        let mut candidate = exe.parent().map(|p| p.to_path_buf())
            .unwrap_or_default();
        let mut found = None;
        for _ in 0..10 {
            let bridge = candidate.join("apps").join("tiktok-bridge");
            if bridge.join("package.json").exists() {
                found = Some(bridge);
                break;
            }
            if !candidate.pop() { break; }
        }
        found.ok_or_else(|| format!(
            "No se encontró apps/tiktok-bridge (buscado desde {}). Configura REACTSTREAM_BRIDGE_DIR.",
            exe.display()
        ))?
    };

    // En Windows, npx es un .cmd — necesita ir por cmd.exe
    #[cfg(target_os = "windows")]
    let child = std::process::Command::new("cmd")
        .args(["/c", "npx", "tsx", "src/index.ts"])
        .current_dir(&bridge_dir)
        .env("REACTSTREAM_TIKTOK_USERNAME",  &username)
        .env("REACTSTREAM_TIKTOK_SESSION_ID", &session_id)
        .env("REACTSTREAM_TIKTOK_TARGET_IDC", &target_idc)
        .env("REACTSTREAM_TIKTOK_COOKIES",    &cookie_string)
        .env("REACTSTREAM_CORE_WS_URL",       "ws://127.0.0.1:47821/bridge")
        .spawn()
        .map_err(|e| format!("No se pudo iniciar el bridge: {e}"))?;

    #[cfg(not(target_os = "windows"))]
    let child = std::process::Command::new("npx")
        .args(["tsx", "src/index.ts"])
        .current_dir(&bridge_dir)
        .env("REACTSTREAM_TIKTOK_USERNAME",  &username)
        .env("REACTSTREAM_TIKTOK_SESSION_ID", &session_id)
        .env("REACTSTREAM_TIKTOK_TARGET_IDC", &target_idc)
        .env("REACTSTREAM_TIKTOK_COOKIES",    &cookie_string)
        .env("REACTSTREAM_CORE_WS_URL",       "ws://127.0.0.1:47821/bridge")
        .spawn()
        .map_err(|e| format!("No se pudo iniciar el bridge: {e}"))?;

    *state.bridge_process.lock().unwrap() = Some(child);

    state.state_mgr.set_tiktok_connection(TikTokConnectionState::Connected);
    state.state_mgr.set_application(ApplicationState::Connected);

    state.logger.log(LogEntry::new(
        &ProductionClock,
        LogLevel::Info,
        "tauri",
        format!("Bridge iniciado para @{username}"),
    ));

    Ok(format!("Conectado a @{username}"))
}

#[tauri::command]
async fn disconnect_tiktok(state: State<'_, CoreState>) -> Result<(), String> {
    // Matar el proceso bridge y todo su árbol de procesos
    {
        let mut guard = state.bridge_process.lock().unwrap();
        if let Some(mut child) = guard.take() {
            // En Windows, child.kill() solo mata cmd.exe pero deja vivos los
            // procesos node/npx hijos. taskkill /F /T mata el árbol completo.
            #[cfg(target_os = "windows")]
            {
                let pid = child.id();
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    // Terminar sesión activa si existe
    state.session_mgr.end_session(&ProductionClock);
    state.session_mgr.clear();
    *state.ws_server.live_started_ms.lock().unwrap() = None;
    *state.ws_server.current_viewers.lock().unwrap() = 0;

    use reactstream_core::contracts::{ApplicationState, TikTokConnectionState};
    state.state_mgr.set_tiktok_connection(TikTokConnectionState::Disconnected);
    state.state_mgr.set_application(ApplicationState::Ready);
    state.logger.log(LogEntry::new(
        &ProductionClock, LogLevel::Info, "tauri", "Bridge TikTok detenido",
    ));
    Ok(())
}

#[tauri::command]
async fn start_session(
    tiktok_user_id: String,
    state: State<'_, CoreState>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let clock = ProductionClock;
    let username = state.tiktok_username.lock().unwrap().clone();

    state.session_mgr.start_session(&clock, &session_id, &tiktok_user_id, &username);
    state.event_bus.set_active_session(Some(session_id.clone()));

    // Inicializar Timer con la configuración actual
    let settings = state.settings_mgr.snapshot();
    let timer = Arc::new(TimerEngine::new(&settings, &clock, &session_id));
    *state.timer_engine.lock().unwrap() = Some(timer.clone());
    reactstream_core::timer::wire_to_event_bus(timer, &state.event_bus, Arc::new(clock));

    use reactstream_core::contracts::{ApplicationState, SessionStatus};
    state.state_mgr.set_session(SessionStatus::Active);
    state.state_mgr.set_application(ApplicationState::Live);

    state.logger.log(LogEntry::new(
        &ProductionClock, LogLevel::Info, "tauri",
        format!("Sesión iniciada: {session_id}"),
    ));

    Ok(session_id)
}

#[tauri::command]
async fn end_session(state: State<'_, CoreState>) -> Result<(), String> {
    let clock = ProductionClock;
    state.session_mgr.end_session(&clock);
    state.event_bus.set_active_session(None);
    state.ranking_mgr.reset();
    state.best_gift_mgr.reset();
    *state.timer_engine.lock().unwrap() = None;

    use reactstream_core::contracts::{ApplicationState, SessionStatus};
    state.state_mgr.set_session(SessionStatus::NoSession);
    state.state_mgr.set_application(ApplicationState::Connected);

    Ok(())
}

#[tauri::command]
async fn get_session_stats(state: State<'_, CoreState>) -> Result<Option<SessionStatsDto>, String> {
    let Some(snap) = state.session_mgr.snapshot() else {
        return Ok(None);
    };
    // El live terminó — informar al frontend para que actualice el estado
    if snap.ended_at.is_some() {
        return Ok(None);
    }
    let current_viewers = *state.ws_server.current_viewers.lock().unwrap();

    // Duración real: si el live sigue activo usamos live_started_ms; si terminó usamos ended_at
    let duration_seconds = match snap.ended_at {
        Some(ended) => ended.saturating_sub(snap.started_at) / 1000,
        None => {
            let started = *state.ws_server.live_started_ms.lock().unwrap();
            if let Some(started_ms) = started {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
                now_ms.saturating_sub(started_ms) / 1000
            } else {
                0
            }
        }
    };

    Ok(Some(SessionStatsDto {
        session_id:       snap.id.clone(),
        total_coins:      snap.counters.total_coins,
        total_likes:      snap.counters.total_likes,
        total_gifts:      snap.counters.total_gifts,
        total_follows:    snap.counters.total_follows,
        total_shares:     snap.counters.total_shares,
        total_comments:   snap.counters.total_comments,
        max_viewers:      snap.counters.max_viewers,
        current_viewers,
        duration_seconds,
        best_gift_name:   snap.best_gift.as_ref().map(|b| b.gift.name.clone()),
        best_gift_coins:  snap.best_gift.as_ref().map(|b| b.coins),
        best_gift_sender: snap.best_gift.as_ref().map(|b| b.sender.display_name.clone()),
    }))
}

#[tauri::command]
async fn get_timer_state(state: State<'_, CoreState>) -> Result<TimerStateDto, String> {
    let guard = state.timer_engine.lock().unwrap();
    match guard.as_ref() {
        Some(t) => Ok(TimerStateDto {
            remaining_seconds: t.remaining_seconds(),
            running: matches!(t.status(), reactstream_core::timer::TimerStatus::Running),
        }),
        None => Ok(TimerStateDto { remaining_seconds: 0, running: false }),
    }
}

#[tauri::command]
async fn get_top_donors(state: State<'_, CoreState>) -> Result<Vec<DonorDto>, String> {
    Ok(state.ranking_mgr.top_donors().into_iter().map(|d| DonorDto {
        user_id:      d.user.id,
        display_name: d.user.display_name,
        avatar_url:   d.user.avatar_url,
        coins:        d.coins,
    }).collect())
}

#[tauri::command]
async fn get_top_tappers(state: State<'_, CoreState>) -> Result<Vec<TapperDto>, String> {
    Ok(state.ranking_mgr.top_tappers().into_iter().map(|t| TapperDto {
        user_id:      t.user.id,
        display_name: t.user.display_name,
        avatar_url:   t.user.avatar_url,
        likes:        t.likes,
    }).collect())
}

#[tauri::command]
async fn get_gift_catalog(state: State<'_, CoreState>) -> Result<Vec<GiftCatalogItemDto>, String> {
    let catalog = state.ws_server.gift_catalog
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(catalog.iter().map(|g| GiftCatalogItemDto {
        id:        g.id.clone(),
        name:      g.name.clone(),
        coins:     g.coins,
        image_url: g.image_url.clone(),
    }).collect())
}

/// Devuelve y borra el último estado del bridge (not_live, error, etc.).
/// El frontend lo consulta después de conectar para mostrar errores.
#[tauri::command]
async fn get_bridge_status(state: State<'_, CoreState>) -> Result<Option<serde_json::Value>, String> {
    let mut guard = state.ws_server.bridge_status.lock().map_err(|e| e.to_string())?;
    Ok(guard.take().map(|s| serde_json::json!({ "status": s.status, "message": s.message })))
}

/// Devuelve y borra los datos de perfil del dueño del live (avatar + display name).
/// El frontend lo consulta después de conectar para mostrar la foto de perfil real.
#[tauri::command]
async fn get_tiktok_profile(state: State<'_, CoreState>) -> Result<Option<serde_json::Value>, String> {
    let mut guard = state.ws_server.profile_update.lock().map_err(|e| e.to_string())?;
    Ok(guard.take().map(|p| serde_json::json!({
        "avatarUrl":   p.avatar_url,
        "displayName": p.display_name,
    })))
}

/// Persiste avatar_url y display_name en la sesión guardada.
/// Llamado por el frontend tras recibir el perfil del bridge.
#[tauri::command]
async fn save_tiktok_profile(
    avatar_url: String,
    display_name: String,
    state: State<'_, CoreState>,
) -> Result<(), String> {
    let mut sess_guard = state.tiktok_session.lock().unwrap();
    if let Some(ref mut sess) = *sess_guard {
        sess.avatar_url   = avatar_url;
        sess.display_name = display_name;
        save_session(sess);
    }
    Ok(())
}

#[tauri::command]
async fn get_settings(
    state: State<'_, CoreState>,
) -> Result<reactstream_core::state::settings::AppSettings, String> {
    Ok(state.settings_mgr.snapshot())
}

#[tauri::command]
async fn update_setting(
    key: String,
    value: String,
    state: State<'_, CoreState>,
) -> Result<(), String> {
    let session_active = matches!(
        state.state_mgr.snapshot().session,
        reactstream_core::contracts::SessionStatus::Active
    );
    state.settings_mgr.try_update(&key, session_active, |s| {
        match key.as_str() {
            "timer_initial"          => { if let Ok(v) = value.parse() { s.timer_initial = v; } }
            "timer_coins_per_second" => { if let Ok(v) = value.parse() { s.timer_coins_per_second = v; } }
            "timer_reactivate_on_zero" => { s.timer_reactivate_on_zero = value == "true"; }
            "donor_top_count"        => { if let Ok(v) = value.parse() { s.donor_top_count = v; } }
            "tap_top_count"          => { if let Ok(v) = value.parse() { s.tap_top_count = v; } }
            "volume"                 => { if let Ok(v) = value.parse() { s.volume = v; } }
            "tiktok_username"        => { s.tiktok_username = if value.is_empty() { None } else { Some(value) }; }
            _ => {}
        }
    })
}

// ============================================================
// TikTok Login — WebView + extracción de cookies
// ============================================================

#[tauri::command]
async fn tiktok_login(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    // Cerrar ventana previa si existe
    if let Some(w) = app_handle.get_webview_window("tiktok-login") {
        w.close().ok();
    }

    let login_url = "https://www.tiktok.com/login"
        .parse::<tauri::Url>()
        .map_err(|e| e.to_string())?;

    let app_nav = app_handle.clone();

    WebviewWindowBuilder::new(&app_handle, "tiktok-login", WebviewUrl::External(login_url))
        .title("Conectar cuenta TikTok")
        .inner_size(520.0, 760.0)
        .resizable(false)
        .on_navigation(move |url| {
            let url_str = url.to_string();
            // Detectar post-login: URL de TikTok que NO sea login/signup
            let is_post_login = url_str.starts_with("https://www.tiktok.com")
                && !url_str.contains("/login")
                && !url_str.contains("/signup")
                && !url_str.contains("/explore")
                && url_str != "https://www.tiktok.com/";

            if is_post_login {
                let app = app_nav.clone();
                std::thread::spawn(move || {
                    // Breve pausa para que WebView2 confirme las cookies
                    std::thread::sleep(std::time::Duration::from_millis(800));
                    if let Some(window) = app.get_webview_window("tiktok-login") {
                        extract_and_store_cookies(window, app.clone());
                    }
                });
            }
            true // permitir toda navegación
        })
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

fn extract_and_store_cookies(window: tauri::WebviewWindow, app: tauri::AppHandle) {
    let window_label = window.label().to_string();
    let app_outer = app.clone();

    let result = window.with_webview(move |wv| {
        #[cfg(target_os = "windows")]
        {
            let app_for_reg = app.clone();
            let app_for_err = app.clone();
            let lbl = window_label.clone();
            if let Err(e) = register_cookie_extraction(&wv, app_for_reg, window_label) {
                let _ = app_for_err.emit(
                    "tiktok-login-result",
                    TikTokLoginResult { success: false, username: None, error: Some(e) },
                );
                if let Some(w) = app_for_err.get_webview_window(&lbl) {
                    w.close().ok();
                }
            }
            // On success the callback handles close + event emission
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = app.emit(
                "tiktok-login-result",
                TikTokLoginResult {
                    success: false, username: None,
                    error: Some("Extracción de cookies solo soportada en Windows".to_string()),
                },
            );
            if let Some(w) = app.get_webview_window(&window_label) {
                w.close().ok();
            }
        }
    });

    if let Err(e) = result {
        let _ = app_outer.emit(
            "tiktok-login-result",
            TikTokLoginResult { success: false, username: None, error: Some(e.to_string()) },
        );
        window.close().ok();
    }
}

// Registra el callback de extracción de cookies y retorna inmediatamente.
// El callback se invoca de forma asíncrona por WebView2, evitando deadlock.
#[cfg(target_os = "windows")]
fn register_cookie_extraction(
    wv: &tauri::webview::PlatformWebview,
    app: tauri::AppHandle,
    window_label: String,
) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2_2, ICoreWebView2CookieList,
    };
    use windows::core::{Interface, HSTRING};

    let controller = wv.controller();
    let core_wv: ICoreWebView2 = unsafe { controller.CoreWebView2() }
        .map_err(|e| format!("CoreWebView2: {e}"))?;
    let core_wv2: ICoreWebView2_2 = core_wv
        .cast()
        .map_err(|e| format!("cast ICoreWebView2_2: {e}"))?;
    let mgr = unsafe { core_wv2.CookieManager() }
        .map_err(|e| format!("CookieManager: {e}"))?;

    let handler = webview2_com::GetCookiesCompletedHandler::create(Box::new(
        move |_, cookie_list: Option<ICoreWebView2CookieList>| {
            let login_result = match parse_tiktok_cookies(cookie_list) {
                Ok(session) => {
                    let state = app.state::<CoreState>();
                    if !session.username.is_empty() {
                        *state.tiktok_username.lock().unwrap() = session.username.clone();
                    }
                    save_session(&session);
                    *state.tiktok_session.lock().unwrap() = Some(session.clone());
                    TikTokLoginResult {
                        success: true,
                        username: Some(session.username),
                        error: None,
                    }
                }
                Err(e) => TikTokLoginResult { success: false, username: None, error: Some(e) },
            };
            let _ = app.emit("tiktok-login-result", login_result);
            if let Some(w) = app.get_webview_window(&window_label) {
                w.close().ok();
            }
            Ok(())
        },
    ));

    let uri = HSTRING::from("https://www.tiktok.com");
    unsafe { mgr.GetCookies(&uri, &handler) }
        .map_err(|e| format!("GetCookies: {e}"))?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn parse_tiktok_cookies(
    cookie_list: Option<webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2CookieList>,
) -> Result<TikTokSession, String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Cookie;
    use windows::core::PWSTR;

    let list = cookie_list.ok_or_else(|| "Lista de cookies vacía".to_string())?;
    let mut count = 0u32;
    unsafe { list.Count(&mut count) }.map_err(|e| format!("Count: {e}"))?;

    let mut session_id: Option<String> = None;
    let mut tt_target_idc: Option<String> = None;
    let mut all_cookies: Vec<String> = Vec::new();

    for i in 0..count {
        let cookie: ICoreWebView2Cookie = match unsafe { list.GetValueAtIndex(i) } {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut name_pw = PWSTR(std::ptr::null_mut());
        let mut val_pw  = PWSTR(std::ptr::null_mut());
        let _ = unsafe { cookie.Name(&mut name_pw) };
        let _ = unsafe { cookie.Value(&mut val_pw) };

        let name  = pwstr_to_string(name_pw);
        let value = pwstr_to_string(val_pw);

        if name.is_empty() { continue; }

        // Acumular todas las cookies para el header Cookie completo
        all_cookies.push(format!("{name}={value}"));

        match name.as_str() {
            "sessionid"     => session_id    = Some(value),
            "tt-target-idc" => tt_target_idc = Some(value),
            _ => {}
        }
    }

    Ok(TikTokSession {
        session_id:    session_id
            .ok_or_else(|| "Cookie 'sessionid' no encontrada. Completa el login.".to_string())?,
        tt_target_idc: tt_target_idc.unwrap_or_default(),
        username:      String::new(),
        display_name:  String::new(),
        avatar_url:    String::new(),
        cookie_string: all_cookies.join("; "),
    })
}

#[cfg(target_os = "windows")]
fn pwstr_to_string(pwstr: windows::core::PWSTR) -> String {
    if pwstr.0.is_null() {
        return String::new();
    }
    let len = (0usize..).take_while(|&i| unsafe { *pwstr.0.add(i) } != 0).count();
    String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(pwstr.0, len) })
}

#[tauri::command]
async fn get_tiktok_session(
    state: State<'_, CoreState>,
) -> Result<Option<TikTokSession>, String> {
    Ok(state.tiktok_session.lock().unwrap().clone())
}

#[tauri::command]
async fn tiktok_logout(state: State<'_, CoreState>) -> Result<(), String> {
    *state.tiktok_session.lock().unwrap() = None;
    *state.tiktok_username.lock().unwrap() = String::new();
    if let Some(path) = session_file_path() {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

// ============================================================
// Detección de herramientas del sistema
// ============================================================

#[tauri::command]
async fn check_autoit_installed() -> bool {
    let paths = [
        r"C:\Program Files (x86)\AutoIt3\AutoIt3.exe",
        r"C:\Program Files\AutoIt3\AutoIt3.exe",
        r"C:\AutoIt3\AutoIt3.exe",
    ];
    paths.iter().any(|p| std::path::Path::new(p).exists())
}

// ============================================================
// Ejecución de KeyStrokes via AutoIt
// ============================================================

fn simple_key_to_autoit(key: &str) -> String {
    match key.trim().to_uppercase().as_str() {
        "SPACE" | "SPACEBAR"          => "{SPACE}".to_string(),
        "ENTER" | "RETURN"            => "{ENTER}".to_string(),
        "TAB"                         => "{TAB}".to_string(),
        "ESC" | "ESCAPE"              => "{ESC}".to_string(),
        "BACKSPACE" | "BS"            => "{BACKSPACE}".to_string(),
        "DELETE" | "DEL"              => "{DELETE}".to_string(),
        "UP"                          => "{UP}".to_string(),
        "DOWN"                        => "{DOWN}".to_string(),
        "LEFT"                        => "{LEFT}".to_string(),
        "RIGHT"                       => "{RIGHT}".to_string(),
        "HOME"                        => "{HOME}".to_string(),
        "END"                         => "{END}".to_string(),
        "PGUP" | "PAGEUP"             => "{PGUP}".to_string(),
        "PGDN" | "PAGEDOWN"           => "{PGDN}".to_string(),
        "INSERT" | "INS"              => "{INSERT}".to_string(),
        k if k.starts_with('F')
            && k.len() >= 2
            && k.len() <= 3
            && k[1..].parse::<u8>().is_ok() => format!("{{{k}}}"),
        k if k.len() == 1             => k.to_lowercase(),
        other                         => format!("{{{other}}}"),
    }
}

fn key_to_autoit(key: &str) -> String {
    let trimmed = key.trim();
    if trimmed.contains('+') {
        let parts: Vec<&str> = trimmed.split('+').collect();
        if parts.len() < 2 {
            return simple_key_to_autoit(trimmed);
        }
        let mut prefix = String::new();
        for modifier in &parts[..parts.len() - 1] {
            match modifier.trim().to_uppercase().as_str() {
                "CTRL" | "CONTROL" => prefix.push('^'),
                "ALT"              => prefix.push('!'),
                "SHIFT"            => prefix.push('+'),
                _                  => {}
            }
        }
        let base = simple_key_to_autoit(parts.last().unwrap().trim());
        return format!("{prefix}{base}");
    }
    simple_key_to_autoit(trimmed)
}

#[tauri::command]
async fn execute_keystroke(
    keys: Vec<String>,
    repeat_count: u32,
    delay_ms: u64,
) -> Result<(), String> {
    // Bloquear combinaciones peligrosas
    let blocked = ["alt+f4", "win", "lwin", "rwin", "ctrl+alt+del"];
    for key in &keys {
        let lower = key.to_lowercase();
        if blocked.iter().any(|b| lower.contains(b)) {
            return Err(format!("Tecla bloqueada por seguridad: {key}"));
        }
    }

    let autoit_exe = [
        r"C:\Program Files (x86)\AutoIt3\AutoIt3.exe",
        r"C:\Program Files\AutoIt3\AutoIt3.exe",
        r"C:\AutoIt3\AutoIt3.exe",
    ]
    .iter()
    .find(|p| std::path::Path::new(p).exists())
    .ok_or_else(|| "AutoIt no detectado — instala AutoIt para ejecutar keystrokes reales".to_string())?;

    let mut lines = vec!["#NoTrayIcon".to_string()];
    for _ in 0..repeat_count.max(1) {
        for key in &keys {
            let au = key_to_autoit(key);
            lines.push(format!("Send(\"{au}\")"));
            if delay_ms > 0 {
                lines.push(format!("Sleep({delay_ms})"));
            }
        }
    }
    let script = lines.join("\r\n");

    let temp_path = std::env::temp_dir().join("rs_keystroke.au3");
    std::fs::write(&temp_path, script.as_bytes())
        .map_err(|e| format!("Error escribiendo script AutoIt: {e}"))?;

    std::process::Command::new(autoit_exe)
        .arg(&temp_path)
        .spawn()
        .map_err(|e| format!("Error ejecutando AutoIt: {e}"))?;

    Ok(())
}

// ============================================================
// Selector de archivo de audio
// ============================================================

#[tauri::command]
async fn pick_audio_file() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("Audio", &["mp3", "wav", "ogg"])
            .set_title("Seleccionar archivo de audio")
            .pick_file()
            .map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())
}

// ============================================================
// Abrir URL en el navegador por defecto
// ============================================================

#[tauri::command]
async fn open_in_browser(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Error abriendo URL: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Error abriendo URL: {e}"))?;
    }
    Ok(())
}

// ============================================================
// Señalizar overlay para que muestre un efecto
// ============================================================

#[tauri::command]
async fn trigger_media_overlay(
    overlay_id: String,
    payload: serde_json::Value,
    state: State<'_, CoreState>,
) -> Result<(), String> {
    let msg = serde_json::to_string(&payload).map_err(|e| e.to_string())?;
    state.ws_server.broadcast_overlay(&overlay_id, msg);
    Ok(())
}

// ============================================================
// HTTP Server para Overlays (puerto 47820)
// TikTok Studio y OBS cargan esta URL como Browser Source.
// Cada página HTML se conecta internamente al WS en 47821.
// ============================================================

const OVERLAY_HTTP_PORT: u16 = 47820;

const OVERLAY_TIMER_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent!important;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif}
.c{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
#t{font-size:clamp(64px,14vw,160px);font-weight:900;color:#4ade80;line-height:1;text-shadow:0 0 40px rgba(74,222,128,.5),0 2px 0 #000,2px 2px 0 #000;font-variant-numeric:tabular-nums;letter-spacing:-2px;transition:color .3s}
#t.z{color:#f87171;text-shadow:0 0 40px rgba(248,113,113,.5),0 2px 0 #000,2px 2px 0 #000;animation:blink .5s infinite alternate}
.lb{font-size:clamp(11px,1.8vw,18px);color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:6px;text-shadow:0 1px 4px #000}
@keyframes blink{to{opacity:.35}}
</style></head><body>
<div class="c"><div id="t">--:--</div><div class="lb">TIMER</div></div>
<script>
function fmt(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function go(){var w=new WebSocket('ws://127.0.0.1:47821');
w.onopen=function(){w.send(JSON.stringify({clientType:'overlay',overlayId:'timer'}))};
w.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.messageType==='timer_updated'){var el=document.getElementById('t');var r=m.payload.remainingSeconds;el.textContent=fmt(r);el.className=r===0?'z':''}}catch(x){}};
w.onclose=function(){setTimeout(go,3000)}}
go();
</script></body></html>"#;

const OVERLAY_DONORS_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent!important;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;padding:16px}
h2{color:#fde047;font-size:clamp(13px,2.2vw,20px);text-transform:uppercase;letter-spacing:4px;margin-bottom:10px;text-shadow:0 2px 8px #000}
.row{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);border-radius:8px;padding:7px 12px;margin-bottom:5px;border-left:3px solid #fde047}
.rk{font-size:clamp(15px,2vw,20px);font-weight:900;color:#fde047;width:26px;flex-shrink:0;text-align:center}
.nm{flex:1;color:#fff;font-size:clamp(12px,1.8vw,16px);font-weight:600;text-shadow:0 1px 3px #000;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cn{color:#fde047;font-size:clamp(11px,1.5vw,14px);font-weight:700;white-space:nowrap}
.empty{color:rgba(255,255,255,.5);font-size:13px;padding:14px 0;text-shadow:0 1px 4px #000}
</style></head><body>
<h2>🏆 Top Donors</h2>
<div id="list"><div class="empty">Esperando datos del LIVE...</div></div>
<script>
var M=['🥇','🥈','🥉'];
function go(){var w=new WebSocket('ws://127.0.0.1:47821');
w.onopen=function(){w.send(JSON.stringify({clientType:'overlay',overlayId:'donors'}))};
w.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.messageType==='ranking_updated'&&m.overlayId==='donors'){var d=m.payload.donors||[];document.getElementById('list').innerHTML=d.length?d.map(function(x,i){return'<div class="row"><span class="rk">'+(M[i]||'#'+(i+1))+'</span><span class="nm">'+x.displayName+'</span><span class="cn">🪙'+x.coins.toLocaleString()+'</span></div>'}).join(''):'<div class="empty">Sin datos todavía</div>'}}catch(x){}};
w.onclose=function(){setTimeout(go,3000)}}
go();
</script></body></html>"#;

const OVERLAY_TAPPERS_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent!important;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;padding:16px}
h2{color:#f9a8d4;font-size:clamp(13px,2.2vw,20px);text-transform:uppercase;letter-spacing:4px;margin-bottom:10px;text-shadow:0 2px 8px #000}
.row{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);border-radius:8px;padding:7px 12px;margin-bottom:5px;border-left:3px solid #f9a8d4}
.rk{font-size:clamp(15px,2vw,20px);font-weight:900;color:#f9a8d4;width:26px;flex-shrink:0;text-align:center}
.nm{flex:1;color:#fff;font-size:clamp(12px,1.8vw,16px);font-weight:600;text-shadow:0 1px 3px #000;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.lk{color:#f9a8d4;font-size:clamp(11px,1.5vw,14px);font-weight:700;white-space:nowrap}
.empty{color:rgba(255,255,255,.5);font-size:13px;padding:14px 0;text-shadow:0 1px 4px #000}
</style></head><body>
<h2>❤️ Top Tap Tap</h2>
<div id="list"><div class="empty">Esperando datos del LIVE...</div></div>
<script>
var M=['🥇','🥈','🥉'];
function go(){var w=new WebSocket('ws://127.0.0.1:47821');
w.onopen=function(){w.send(JSON.stringify({clientType:'overlay',overlayId:'tappers'}))};
w.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.messageType==='ranking_updated'&&m.overlayId==='tappers'){var d=m.payload.tappers||[];document.getElementById('list').innerHTML=d.length?d.map(function(x,i){return'<div class="row"><span class="rk">'+(M[i]||'#'+(i+1))+'</span><span class="nm">'+x.displayName+'</span><span class="lk">❤️ '+x.likes.toLocaleString()+'</span></div>'}).join(''):'<div class="empty">Sin datos todavía</div>'}}catch(x){}};
w.onclose=function(){setTimeout(go,3000)}}
go();
</script></body></html>"#;

const OVERLAY_BEST_GIFT_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent!important;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:rgba(0,0,0,.65);backdrop-filter:blur(10px);border-radius:16px;padding:20px 28px;text-align:center;border:2px solid rgba(253,224,71,.45);box-shadow:0 0 40px rgba(253,224,71,.25);display:none;flex-direction:column;align-items:center;gap:6px;animation:pop .4s cubic-bezier(.34,1.56,.64,1)}
.card.on{display:flex}
@keyframes pop{from{transform:scale(0.7);opacity:0}to{transform:scale(1);opacity:1}}
.ic{font-size:40px}
.gn{font-size:clamp(22px,4vw,40px);font-weight:900;color:#fde047;text-shadow:0 0 20px rgba(253,224,71,.6)}
.co{font-size:clamp(14px,2.2vw,22px);color:#fff;text-shadow:0 1px 4px #000}
.sn{font-size:clamp(11px,1.6vw,15px);color:rgba(255,255,255,.7);text-shadow:0 1px 3px #000}
.lb{font-size:10px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:3px;margin-top:2px}
.ph{color:rgba(255,255,255,.45);font-size:14px;text-shadow:0 1px 4px #000;text-align:center}
</style></head><body>
<div id="wrap"><div class="ph">👑 Mejor regalo aparecerá aquí</div></div>
<script>
function go(){var w=new WebSocket('ws://127.0.0.1:47821');
w.onopen=function(){w.send(JSON.stringify({clientType:'overlay',overlayId:'best-gift'}))};
w.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.messageType==='best_gift_updated'){var p=m.payload;document.getElementById('wrap').innerHTML='<div class="card on"><div class="ic">👑</div><div class="gn">'+p.giftName+'</div><div class="co">🪙 '+Number(p.coins).toLocaleString()+' coins</div><div class="sn">de @'+p.senderName+'</div><div class="lb">Mejor Regalo del LIVE</div></div>'}}catch(x){}};
w.onclose=function(){setTimeout(go,3000)}}
go();
</script></body></html>"#;

const OVERLAY_LIKES_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent!important;overflow:hidden;width:100%;height:100vh;font-family:'Segoe UI',Arial,sans-serif}
.heart{position:fixed;bottom:-60px;font-size:clamp(28px,5vw,52px);animation:up var(--d,3s) ease-in forwards;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5)) drop-shadow(0 0 8px rgba(255,100,150,.6))}
@keyframes up{0%{bottom:-60px;opacity:1;transform:translateX(0) scale(1) rotate(0deg)}40%{opacity:1}100%{bottom:105vh;opacity:0;transform:translateX(var(--sx,20px)) scale(.7) rotate(var(--r,10deg))}}
</style></head><body>
<script>
var E=['❤️','🩷','💕','💖','💗','🌹','💝'];
function spawn(n){for(var i=0;i<Math.min(n,6);i++){(function(idx){setTimeout(function(){var h=document.createElement('span');h.className='heart';h.textContent=E[Math.floor(Math.random()*E.length)];var l=8+Math.random()*84;h.style.cssText='left:'+l+'%;--d:'+(2.2+Math.random()*1.8)+'s;--sx:'+(Math.random()*60-30)+'px;--r:'+(Math.random()*20-10)+'deg';document.body.appendChild(h);h.addEventListener('animationend',function(){h.remove()})},idx*180)})(i)}}
function go(){var w=new WebSocket('ws://127.0.0.1:47821');
w.onopen=function(){w.send(JSON.stringify({clientType:'overlay',overlayId:'likes'}))};
w.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.messageType==='likes_received'){spawn(m.payload.count||1)}}catch(x){}};
w.onclose=function(){setTimeout(go,3000)}}
go();
</script></body></html>"#;

const OVERLAY_JAR_HTML: &str = r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent!important;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;padding:16px}
h2{color:#c084fc;font-size:clamp(13px,2.2vw,20px);text-transform:uppercase;letter-spacing:4px;margin-bottom:10px;text-shadow:0 2px 8px #000}
.gift{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);border-radius:8px;padding:7px 12px;margin-bottom:5px;border-left:3px solid #c084fc;animation:slide .35s ease}
@keyframes slide{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
.gn{flex:1;color:#fff;font-size:clamp(12px,1.8vw,15px);font-weight:600;text-shadow:0 1px 3px #000;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.gc{color:#c084fc;font-size:clamp(10px,1.4vw,13px);font-weight:700;white-space:nowrap}
.gs{color:rgba(255,255,255,.6);font-size:clamp(10px,1.3vw,12px);white-space:nowrap}
.empty{color:rgba(255,255,255,.5);font-size:13px;padding:14px 0;text-shadow:0 1px 4px #000}
</style></head><body>
<h2>🫙 Gift Jar</h2>
<div id="jar"><div class="empty">Los regalos aparecerán aquí...</div></div>
<script>
var gifts=[];var MAX=8;
function render(){var el=document.getElementById('jar');if(!gifts.length){el.innerHTML='<div class="empty">Los regalos aparecerán aquí...</div>';return}var sl=gifts.slice(-MAX).reverse();el.innerHTML=sl.map(function(g){return'<div class="gift"><span class="gn">🎁 '+g.name+'</span><span class="gc">🪙'+Number(g.coins).toLocaleString()+'</span><span class="gs">@'+g.sender+'</span></div>'}).join('')}
function go(){var w=new WebSocket('ws://127.0.0.1:47821');
w.onopen=function(){w.send(JSON.stringify({clientType:'overlay',overlayId:'jar'}))};
w.onmessage=function(e){try{var m=JSON.parse(e.data);if(m.messageType==='gift_received'&&m.overlayId==='jar'){var p=m.payload;gifts.push({name:p.giftName,coins:p.coins,sender:p.senderName});render()}}catch(x){}};
w.onclose=function(){setTimeout(go,3000)}}
go();
</script></body></html>"#;

async fn run_overlay_http_server() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let bind_addr = format!("127.0.0.1:{OVERLAY_HTTP_PORT}");
    let listener = match tokio::net::TcpListener::bind(&bind_addr).await {
        Ok(l) => {
            println!("[overlay-http] Servidor HTTP de overlays en http://{bind_addr}/overlay/<id>");
            l
        }
        Err(e) => {
            eprintln!("[overlay-http] No se pudo iniciar en {bind_addr}: {e}");
            return;
        }
    };

    loop {
        let Ok((mut stream, _addr)) = listener.accept().await else { continue };

        tokio::spawn(async move {
            let mut buf = vec![0u8; 2048];
            let n = match stream.read(&mut buf).await {
                Ok(n) if n > 0 => n,
                _ => return,
            };

            let raw = String::from_utf8_lossy(&buf[..n]);
            let path = raw
                .lines()
                .next()
                .and_then(|l| l.split_whitespace().nth(1))
                .unwrap_or("/")
                .split('?')
                .next()
                .unwrap_or("/")
                .to_owned();

            let html: Option<&'static str> = match path.as_str() {
                "/overlay/timer.html"     | "/overlay/timer"     => Some(OVERLAY_TIMER_HTML),
                "/overlay/donors.html"    | "/overlay/donors"    => Some(OVERLAY_DONORS_HTML),
                "/overlay/tappers.html"   | "/overlay/tappers"   => Some(OVERLAY_TAPPERS_HTML),
                "/overlay/best-gift.html" | "/overlay/best-gift" => Some(OVERLAY_BEST_GIFT_HTML),
                "/overlay/likes.html"     | "/overlay/likes"     => Some(OVERLAY_LIKES_HTML),
                "/overlay/jar.html"       | "/overlay/jar"       => Some(OVERLAY_JAR_HTML),
                _                        => None,
            };

            let response = match html {
                Some(body) => format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                ),
                None => {
                    let msg = "404 Not Found — rutas: /overlay/timer, /overlay/donors, /overlay/tappers, /overlay/best-gift, /overlay/likes, /overlay/jar";
                    format!(
                        "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        msg.len(),
                        msg
                    )
                }
            };

            stream.write_all(response.as_bytes()).await.ok();
        });
    }
}

// ============================================================
// Bootstrap
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(CoreState::new())
        .invoke_handler(tauri::generate_handler![
            get_status,
            connect_tiktok,
            disconnect_tiktok,
            start_session,
            end_session,
            get_session_stats,
            get_timer_state,
            get_top_donors,
            get_top_tappers,
            get_gift_catalog,
            get_bridge_status,
            get_tiktok_profile,
            save_tiktok_profile,
            get_settings,
            update_setting,
            tiktok_login,
            get_tiktok_session,
            tiktok_logout,
            check_autoit_installed,
            execute_keystroke,
            pick_audio_file,
            open_in_browser,
            trigger_media_overlay,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("ReactStream").unwrap();

            // Arrancar el WebSocket server en background
            let state = app.state::<CoreState>();
            let ws = state.ws_server.clone();
            tauri::async_runtime::spawn(async move {
                ws.run().await;
            });

            // Arrancar el HTTP server de overlays (puerto 47820) en background
            tauri::async_runtime::spawn(run_overlay_http_server());

            // EventBus → Tauri events (bridge para el frontend)
            {
                use reactstream_core::contracts::{AppEvent, EventType};
                let eb = state.event_bus.clone();
                let ah = app.handle().clone();

                let h = ah.clone();
                eb.subscribe(EventType::Gift, Arc::new(move |ev| {
                    if let AppEvent::Gift(e) = ev {
                        let _ = h.emit("rs-tiktok-event", serde_json::json!({
                            "type": "gift",
                            "giftId": e.gift.id,
                            "giftName": e.gift.name,
                            "coins": e.gift.coins,
                            "quantity": e.quantity,
                            "totalCoins": e.total_coins,
                            "username": e.user.display_name,
                        }));
                    }
                }));

                let h = ah.clone();
                eb.subscribe(EventType::Like, Arc::new(move |ev| {
                    if let AppEvent::Like(e) = ev {
                        let _ = h.emit("rs-tiktok-event", serde_json::json!({
                            "type": "like",
                            "count": e.count,
                            "username": e.user.display_name,
                        }));
                    }
                }));

                let h = ah.clone();
                eb.subscribe(EventType::Follow, Arc::new(move |ev| {
                    if let AppEvent::Follow(e) = ev {
                        let _ = h.emit("rs-tiktok-event", serde_json::json!({
                            "type": "follow",
                            "username": e.user.display_name,
                        }));
                    }
                }));

                let h = ah.clone();
                eb.subscribe(EventType::Comment, Arc::new(move |ev| {
                    if let AppEvent::Comment(e) = ev {
                        let _ = h.emit("rs-tiktok-event", serde_json::json!({
                            "type": "comment",
                            "text": e.text,
                            "username": e.user.display_name,
                        }));
                    }
                }));

                let h = ah.clone();
                eb.subscribe(EventType::Share, Arc::new(move |ev| {
                    if let AppEvent::Share(e) = ev {
                        let _ = h.emit("rs-tiktok-event", serde_json::json!({
                            "type": "share",
                            "username": e.user.display_name,
                        }));
                    }
                }));

                let h = ah.clone();
                eb.subscribe(EventType::Member, Arc::new(move |ev| {
                    if let AppEvent::Member(e) = ev {
                        let _ = h.emit("rs-tiktok-event", serde_json::json!({
                            "type": "member",
                            "username": e.user.display_name,
                        }));
                    }
                }));
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al ejecutar ReactStream");
}
