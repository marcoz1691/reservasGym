---
name: reservasgym-tiendas
description: Empaqueta y publica ReservasGym en Google Play y App Store con Capacitor. Úsalo cuando el usuario hable de Android, iOS, APK, Play Store, App Store, Capacitor, cap sync, política de privacidad de la app o checklist de publicación.
allowed-tools: Read, Grep, Glob, Edit, Bash
---

# Publicación en tiendas (Capacitor)

Todo desde `app/`. Checklist completo y vigente: `app/docs/store-checklist.md` (léelo primero). Política de privacidad: `app/docs/privacy-policy-zonacero.md`.

1. `npm run lint && npm run test` deben pasar.
2. `npm run cap:sync` → hace `build:capacitor` y sincroniza los proyectos nativos.
3. Android: `npm run cap:android` abre Android Studio (proyecto en `app/android/`).
4. iOS: solo en macOS. Si falta, `npx cap add ios` y luego `npm run cap:ios`.
5. Recorre el checklist y reporta qué ítems faltan. No inventes IDs de cuenta, claves de firma ni credenciales de tienda.
