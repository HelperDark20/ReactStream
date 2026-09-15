// ReactStream Desktop — shell Tauri.
// Comandos expuestos a React se agregan aquí y se validan en Rust
// antes de tocar reactstream_core (Regla #2-3).

use tauri::Manager;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AppStatus {
    pub application: String,
    pub tiktok_connection: String,
    pub bridge: String,
    pub session: String,
    pub version: String,
}

#[tauri::command]
async fn get_status() -> Result<AppStatus, String> {
    Ok(AppStatus {
        application: "READY".to_string(),
        tiktok_connection: "DISCONNECTED".to_string(),
        bridge: "STOPPED".to_string(),
        session: "NO_SESSION".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
async fn connect_tiktok(username: String) -> Result<String, String> {
    if username.trim().is_empty() {
        return Err("El username no puede estar vacío".to_string());
    }
    // TODO(Etapa 26 completa): lanzar Bridge, conectar Core, emitir eventos
    Ok(format!("Conectando a @{username}..."))
}

#[tauri::command]
async fn disconnect_tiktok() -> Result<(), String> {
    // TODO: detener Bridge, cerrar sesión
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_status,
            connect_tiktok,
            disconnect_tiktok,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("ReactStream").unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al ejecutar ReactStream");
}
