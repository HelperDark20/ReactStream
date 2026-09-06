/**
 * ReactStream Desktop — Shell principal.
 *
 * Regla inmutable #2-3: React NUNCA ejecuta acciones del sistema
 * ni conecta directamente con TikTok. Todo pasa por Tauri Commands/Events
 * hacia el Rust Core.
 *
 * TODO(Etapa 27 — Frontend Shell): layout, navegación, stores reales.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">ReactStream</h1>
        <p className="text-neutral-400 text-sm">Etapa 0 — Foundation</p>
      </div>
    </div>
  );
}
