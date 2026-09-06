# Íconos de ReactStream

Esta carpeta está vacía a propósito. Cuando tengas el logo definitivo (PNG cuadrado,
idealmente 1024x1024), genera el set completo de íconos con el CLI de Tauri desde
tu máquina Windows:

```
npm run tauri icon ruta/al/logo.png
```

Esto crea automáticamente `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`
y el resto de tamaños que referencia `tauri.conf.json`. Mientras tanto, el build
de desarrollo funciona sin íconos (Tauri usa un ícono por defecto).
