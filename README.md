# ReactStream

Automatización de TikTok LIVE para escritorio (Windows). Conecta una cuenta de
TikTok LIVE, recibe eventos en tiempo real, los normaliza, ejecuta automatizaciones
visuales y dispara acciones sobre el PC y overlays compatibles con OBS.

> **Estado**: Etapa 0 — Foundation. Fase de pruebas privadas (sin dominio ni
> distribución pública todavía).

## Principio central

```
Rust Core   → autoridad de la aplicación (toda la lógica de negocio vive aquí)
React       → únicamente interfaz
Node Bridge → únicamente conoce TikTok
Overlays    → únicamente visualizan
SQLite      → configuración, historial y persistencia
RAM         → estado activo del LIVE
```

Ver `docs/architecture/` para el documento maestro completo y las reglas
inmutables que gobiernan cada componente. **Ninguna decisión de arquitectura
se toma sin pasar primero por ese documento.**

## Estructura

```
apps/desktop        Tauri 2 + React + TypeScript + Zustand + Tailwind
apps/tiktok-bridge   Node.js + TypeScript — único componente que conoce TikTok
apps/overlays        HTML/CSS/JS estáticos servidos como Browser Source de OBS
packages/            Contratos y utilidades TypeScript compartidas
core/rust            Rust Core — autoridad de negocio
database/            Migraciones y esquema SQLite
assets/              Sonidos, imágenes de regalos, recursos de overlays
tests/               Integration, E2E, fixtures
docs/                Arquitectura, protocolos, eventos, DB, licenciamiento
```

## Requisitos de desarrollo

- Node.js ≥ 20
- Rust (edition 2021) + Cargo
- Tauri CLI 2 (`npm install` en la raíz lo trae como devDependency de `apps/desktop`)

## Scripts

```bash
npm install          # instala todo el monorepo (npm workspaces)
npm run lint          # ESLint en todo el repo TS
npm run format         # Prettier en todo el repo
npm run typecheck       # tsc --noEmit en todos los packages/apps
npm run dev:desktop      # levanta Vite + Tauri en modo dev
npm run dev:bridge       # levanta el Bridge en modo watch
```

## Reglas no negociables

Este proyecto sigue 90 reglas inmutables de arquitectura definidas en el
documento maestro (`docs/architecture/master-spec.txt`). Las más importantes:

- Rust Core es la única autoridad de negocio.
- React nunca ejecuta acciones del sistema ni conecta directamente con TikTok.
- El Bridge de Node no contiene lógica de negocio.
- Los overlays solo visualizan.
- Ninguna acción usa `eval` ni ejecuta código desde configuraciones.
- Comunicación Bridge↔Core y Core↔Overlays es exclusivamente `127.0.0.1`.

No se agregan funciones fuera del alcance del MVP ni se cambian
responsabilidades de componentes sin una decisión de arquitectura explícita.
