# Cumplimiento legal (LOPDP Ecuador) — estado y pendientes

Rama: `feat/cumplimiento-legal` (desde `main`). Solo local: **sin push ni deploy** hasta que el usuario lo apruebe. Commits sin atribución de bots (sin `Co-Authored-By`, sin "Generated with").

## Pedido del usuario (9 puntos)

1. Términos y condiciones · 2. Política de privacidad · 3. Política de cookies y revisar si hace falta consentimiento · 4. En cada formulario, dos casillas separadas · 5. Registro de cuándo y cómo aceptó cada persona · 6. Política de reembolso · 7. Pedir solo los datos necesarios · 8. Derechos de cada imagen · 9. Cumplir leyes locales (LOPDP 2021 + Reglamento, Decreto 904 de 2023; Ley Orgánica de Defensa del Consumidor).

## Hecho (commit WIP)

- `app/supabase/legal-consents.sql` (**no aplicado en QA**): tabla `legal_consents` de solo agregar (RLS: lectura propia o staff; sin insert/update/delete directos), RPC `record_legal_consent(p_document, p_version, p_context)` (fecha y user-agent del servidor) y `handle_new_user` actualizado para guardar los consentimientos del registro desde `raw_user_meta_data.consents`.
- `src/features/legal/legalDocuments.ts`: documentos con versión — `TERMS_DOCUMENT` (reusa `termsContent.ts`), `PRIVACY`, `REFUND`, `STORAGE` (cookies/almacenamiento local). Datos verificados: Supabase QA y prod en **sa-east-1 (São Paulo)** → transferencia internacional declarada; Vercel (EE. UU.); Pagomedios (Ecuador). Sin analítica ni rastreo → no se requiere banner de cookies.
- `LegalPage.tsx` (rutas públicas `/legal/:slug`, sin sesión) + `LegalLinks`; `LegalDocumentDialog.tsx`; `ConsentCheckbox.tsx`.
- Modelos/repositorios: `LegalConsent*` en `domain/models.ts`, `AuthCredentials.consents`, `recordLegalConsents?(context, consents)` en `data/types.ts`, implementado en `localRepository.ts` (state.legalConsents) y `supabaseRepository.ts` (RPC + metadatos del signUp).
- Registro (`LoginPage.tsx`): dos casillas separadas obligatorias (términos / privacidad) que se envían como `consents`; enlaces legales al pie del login.

## Pendiente

1. **Ficha técnica** (`src/features/profile/FichaTecnicaModal.tsx`): casilla obligatoria de consentimiento expreso para datos de salud (estatura, peso, medidas, dolencias) en el último paso, con `ConsentCheckbox` + `LegalDocumentDialog(PRIVACY)`; al guardar llamar `repo.recordLegalConsents?.('ficha', [{ document: 'health_data', version: PRIVACY.version }])`. Corregir el aviso del paso 1 que dice que los datos "no son compartidos con terceros" (los aloja Supabase como encargado): texto exacto y enlace a la política.
2. **Checkout** (`src/features/memberships/PagomediosCheckoutPage.tsx`): mantener la casilla de términos y agregar una segunda casilla separada de privacidad (datos de facturación enviados a Pagomedios), obligatoria cuando se paga con tarjeta; enlace a la política de reembolsos junto al total. Al crear el pago, registrar `terms` (versión = `resolveTermsDocument(...).version`) y `privacy` con contexto `checkout`. El borrador (`checkoutDraft.ts`) debe recordar también la nueva casilla.
3. **Perfil** (`ProfilePage.tsx`): sección «Documentos legales» con `LegalLinks`. En `LegalPage`, el botón «Volver» debe usar `navigate(-1)` si hay historial y `/login` si no.
4. **Imágenes**: quitar los restos del template de Vite sin uso (`src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`; verificar que nada los importe). Los logos de `public/brand/` son del gimnasio.
5. **Pruebas** (Vitest): registro bloqueado sin las dos casillas y consentimientos enviados; `recordLegalConsents` en el repositorio local; páginas `/legal/*` públicas; ficha exige el consentimiento de salud; checkout exige la segunda casilla con tarjeta. Correr `npx tsc -b` y `npx vitest run` (todo verde).
6. Commit(s) en la rama, sin push.

## Decisiones que quedan para el usuario / cliente (no implementar)

- **Eliminar cuenta borra también los pagos** (`payments.user_id ... on delete cascade`): choca con la conservación contable/tributaria. Opción: anonimizar en vez de borrar (requiere `user_id` nulo y ajustar Cobros).
- Plazo legal de devolución (art. 45 LODC): las fuentes dicen 3 o 15 días; el texto de reembolsos no fija número. Validar con abogado.
- Correo de privacidad `privacidad@zonacerocenter.com` y dominio: confirmar con el cliente.
- Minimización: «Sector/Ciudad de residencia» es obligatorio en la ficha y no parece necesario; proponer que sea opcional.
- Todos los textos son borrador técnico: debe revisarlos un abogado ecuatoriano.
