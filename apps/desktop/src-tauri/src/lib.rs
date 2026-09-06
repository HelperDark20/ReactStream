// ReactStream Desktop — shell Tauri.
//
// Regla inmutable #58: mínimo privilegio. Los comandos expuestos a React
// se agregan explícitamente aquí y se validan en Rust antes de tocar
// reactstream_core (Regla #2-3: React nunca ejecuta acciones del sistema).
//
// TODO(Etapa 26 — Tauri API): registrar comandos/eventos reales.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación ReactStream");
}
