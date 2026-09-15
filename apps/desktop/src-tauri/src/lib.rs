// ReactStream Desktop — Integración Tauri ↔ Core (Etapa 38)
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
use tauri::{Manager, State};
use uuid::Uuid;

// ============================================================
// Estado global del Core (vive en RAM durante toda la sesión)
// ============================================================

pub struct CoreState {
    pub logger:        Arc<InMemoryLogger>,
    pub event_bus:     Arc<EventBus>,
    pub session_mgr:   Arc<SessionManager>,
    pub ranking_mgr:   Arc<RankingEngine>,
    pub best_gift_mgr: Arc<BestGiftEngine>,
    pub timer_engine:  Mutex<Option<Arc<TimerEngine>>>,
    pub settings_mgr:  Arc<SettingsManager>,
    pub state_mgr:     Arc<StateManager>,
    pub overlay_engine:Arc<OverlayEngine>,
    pub ws_server:     Arc<WsServer>,
    pub tiktok_username: Mutex<String>,
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
            timer_engine: Mutex::new(None),
            settings_mgr,
            state_mgr,
            overlay_engine,
            ws_server,
            tiktok_username: Mutex::new(String::new()),
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
    pub application:      String,
    pub tiktok_connection: String,
    pub session:          String,
    pub version:          String,
    pub tiktok_username:  String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatsDto {
    pub session_id:    String,
    pub total_coins:   u64,
    pub total_likes:   u64,
    pub total_gifts:   u64,
    pub total_follows: u64,
    pub total_shares:  u64,
    pub total_comments:u64,
    pub max_viewers:   u64,
    pub duration_seconds: u64,
    pub best_gift_name: Option<String>,
    pub best_gift_coins: Option<u64>,
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
    let snap     = state.state_mgr.snapshot();
    let username = state.tiktok_username.lock().unwrap().clone();
    Ok(AppStatusDto {
        application:       format!("{:?}", snap.application),
        tiktok_connection: format!("{:?}", snap.tiktok_connection),
        session:           format!("{:?}", snap.session),
        version:           env!("CARGO_PKG_VERSION").to_string(),
        tiktok_username:   username,
    })
}

#[tauri::command]
async fn connect_tiktok(
    username: String,
    state: State<'_, CoreState>,
) -> Result<String, String> {
    let username = username.trim().to_string();
    if username.is_empty() {
        return Err("El username no puede estar vacío".to_string());
    }
    *state.tiktok_username.lock().unwrap() = username.clone();

    use reactstream_core::contracts::{ApplicationState, TikTokConnectionState};
    state.state_mgr.set_tiktok_connection(TikTokConnectionState::Connecting);
    state.state_mgr.set_application(ApplicationState::Connecting);

    // TODO(Etapa 24 completa): lanzar el Bridge Node.js como proceso hijo
    // y esperar la señal de conexión establecida. Por ahora simulamos la
    // transición de estado para que el frontend refleje el flujo correcto.
    state.state_mgr.set_tiktok_connection(TikTokConnectionState::Connected);
    state.state_mgr.set_application(ApplicationState::Connected);

    state.logger.log(LogEntry::new(
        &ProductionClock,
        LogLevel::Info,
        "tauri",
        format!("TikTok conectado: @{username}"),
    ));

    Ok(format!("Conectado a @{username}"))
}

#[tauri::command]
async fn disconnect_tiktok(state: State<'_, CoreState>) -> Result<(), String> {
    use reactstream_core::contracts::{ApplicationState, TikTokConnectionState};
    state.state_mgr.set_tiktok_connection(TikTokConnectionState::Disconnected);
    state.state_mgr.set_application(ApplicationState::Ready);
    state.logger.log(LogEntry::new(
        &ProductionClock, LogLevel::Info, "tauri", "TikTok desconectado",
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
    Ok(Some(SessionStatsDto {
        session_id:      snap.id.clone(),
        total_coins:     snap.counters.total_coins,
        total_likes:     snap.counters.total_likes,
        total_gifts:     snap.counters.total_gifts,
        total_follows:   snap.counters.total_follows,
        total_shares:    snap.counters.total_shares,
        total_comments:  snap.counters.total_comments,
        max_viewers:     snap.counters.max_viewers,
        duration_seconds:snap.duration_seconds(),
        best_gift_name:  snap.best_gift.as_ref().map(|b| b.gift.name.clone()),
        best_gift_coins: snap.best_gift.as_ref().map(|b| b.coins),
        best_gift_sender:snap.best_gift.as_ref().map(|b| b.sender.display_name.clone()),
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
async fn get_gift_catalog(_state: State<'_, CoreState>) -> Result<Vec<GiftCatalogItemDto>, String> {
    use reactstream_core::database::repository::gift_catalog_sync::GiftCatalogSyncRepository;
    let db = reactstream_core::database::Database::open_in_memory()
        .map_err(|e| e.to_string())?;
    let repo = GiftCatalogSyncRepository::new(&db);
    let items = repo.list_all().map_err(|e| e.to_string())?;
    Ok(items.into_iter().map(|(id, name, coins, image_url)| GiftCatalogItemDto {
        id,
        name,
        coins: coins as u64,
        image_url,
    }).collect())
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
            get_settings,
            update_setting,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("ReactStream").unwrap();

            // Arrancar el WebSocket server en background
            let state = app.state::<CoreState>();
            let ws = state.ws_server.clone();
            tokio::spawn(async move {
                ws.run().await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al ejecutar ReactStream");
}
