import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config estándar recomendada por Tauri 2 para que el dev server
// conviva con el webview sin conflictos de puertos/HMR.
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
