/**
 * Genera la lista blanca de usuarios reales de PRODUCCIÓN (solo lectura en la base).
 *
 * Prod tiene testers reales (prueba cerrada de Google Play) que no se pueden borrar ni tocar.
 * Este script lista los usuarios Auth que no son de carga y los guarda en
 * load/.tmp-prod/allowed-real-users.json (git lo ignora). Después el operador revisa la lista y
 * aprueba su hash exportando LOAD_ALLOWLIST_SHA256=<hash> en la terminal. Sin ese hash, o si los
 * usuarios reales cambian, seed/mint/k6/check/cleanup abortan.
 *
 * Uso (desde app/):
 *   export LOAD_TARGET=prod LOAD_PROD_CONFIRM=gvgqlmoulgcickxognto-sin-usuarios-reales
 *   node --env-file=.env.load.prod.local load/allowlist-real-users.mjs
 *
 * La lista vence a las 24 h. No imprime claves.
 */
import {
  TARGET,
  PROD_REF,
  ALLOWLIST_PATH,
  loadEnv,
  createClient,
  fail,
  writeJson,
  realUsersOf,
  allowlistHash,
} from './lib/env.mjs'

if (TARGET !== 'prod') fail('La lista blanca solo se usa en producción (LOAD_TARGET=prod). En QA el freno no aplica.')

const env = loadEnv({ service: true })
const { auth } = createClient(env)

const real = realUsersOf(await auth.listUsers())
const data = { project_ref: PROD_REF, generated_at: new Date().toISOString(), users: real }
writeJson(ALLOWLIST_PATH, data)
const hash = allowlistHash(real)

console.log(`=== LISTA BLANCA DE USUARIOS REALES (${env.label}) ===`)
console.log(`Usuarios reales: ${real.length}`)
real.forEach((u, i) => console.log(`  ${String(i + 1).padStart(2)}. ${u.email}  (${u.id})`))
console.log(`\nGuardada en load/.tmp-prod/allowed-real-users.json (vence en 24 h).`)
console.log('Revisa que sean exactamente los testers esperados. Si está bien, apruébala en esta terminal:')
console.log(`  export LOAD_ALLOWLIST_SHA256=${hash}`)
