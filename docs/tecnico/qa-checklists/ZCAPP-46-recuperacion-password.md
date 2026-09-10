# ZCAPP-46 — Checklist «Listo para pruebas»

**Ticket Jira:** ZCAPP-46 · Recuperación de contraseña (SMTP Supabase)

**Dependencia:** SCRUM-14 (auth) y SCRUM-15 (staging) operativos.

**Origen:** deuda técnica dejada en SCRUM-14 — el envío del correo ya existía,
pero no había pantalla para escribir la contraseña nueva. El enlace del correo
llevaba a `/login` y ahí moría el flujo.

## Configuración previa en Supabase

Sin esto el enlace del correo falla con `redirect_to not allowed`:

1. **Authentication → URL Configuration → Redirect URLs**, agregar:
   - `http://localhost:5180/recuperar` (dev)
   - `http://localhost:5190/recuperar` (staging local)
   - La URL de producción cuando exista: `https://<dominio>/recuperar`
2. **Authentication → Email Templates → Reset Password**: verificar que el
   botón use `{{ .ConfirmationURL }}`.
3. **Project Settings → Authentication → SMTP**: en el SMTP por defecto de
   Supabase el envío está limitado (pocos correos por hora) y puede caer en
   spam. Para producción hay que configurar SMTP propio.

## Cómo probar

```bash
cd app && npm run dev:staging
```

Usuarios: ver `app/supabase/staging-users.sql`.

### Modo demo (sin Supabase)

`npm run dev` usa `LocalRepository`. No hay correo: al pedir la recuperación se
marca al usuario y se puede entrar directo a `/recuperar` para simular el
regreso del enlace.

## Criterios de aceptación

- [ ] Desde login → «¿Olvidaste tu contraseña?» abre el modal
- [ ] Enviar con un correo registrado muestra la confirmación
- [ ] Enviar con un correo **no** registrado muestra la **misma** confirmación
      (no debe revelar qué correos existen)
- [ ] Llega el correo de Supabase con el enlace
- [ ] El enlace abre `/recuperar` con el formulario, no `/login`
- [ ] Contraseña menor a 8 caracteres → error, no guarda
- [ ] Contraseña sin números → error, no guarda
- [ ] Contraseñas que no coinciden → error, no guarda
- [ ] Contraseña válida → confirma y deja la sesión iniciada
- [ ] La contraseña **nueva** sirve para entrar
- [ ] La contraseña **anterior** ya no sirve
- [ ] Reutilizar el mismo enlace del correo → «enlace vencido o inválido»
- [ ] Entrar a `/recuperar` directo, sin enlace → «enlace vencido o inválido»
- [ ] `npm test` pasa (212 tests)

## Cobertura automatizada

| Archivo | Qué cubre |
|---|---|
| `app/src/domain/rules/password.test.ts` | 17 casos: largo mínimo, letras, números, acentos/ñ, coincidencia, fuerza |
| `app/src/data/passwordRecovery.test.ts` | 11 casos: no enumerar correos, normalizar el email, invalidar la clave anterior, enlace de un solo uso, sesión tras el cambio |
| `app/src/features/auth/ResetPasswordPage.test.tsx` | 5 casos: enlace inválido, validaciones en pantalla, guardado exitoso |

## Notas de implementación

- `detectSessionInUrl: true` explícito en el cliente Supabase: es el default,
  pero todo el flujo depende de que el token del hash se canjee por sesión.
- Al cambiar la contraseña se invalida el `sessionToken` guardado, de modo que
  las demás sesiones abiertas quedan cerradas.
- Cada cambio genera un salt nuevo: dos cambios a la misma contraseña producen
  hashes distintos.

## Evidencia

- Video o screenshots del flujo completo (correo → enlace → contraseña nueva → login)
- PR o commit hash
