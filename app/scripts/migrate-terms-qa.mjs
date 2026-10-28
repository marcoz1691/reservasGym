import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const QA_REF = 'kqhmclbexnnsbzbgerbx'
const root = new URL('../', import.meta.url)
const project = process.env.SUPABASE_PROJECT_REF?.trim() || QA_REF

async function managementToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim()
  try {
    const text = await readFile(new URL('.env.supabase.local', root), 'utf8')
    const token = text.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+?)\s*$/m)?.[1]?.replace(/^["']|["']$/g, '')
    if (token) return token
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  try {
    return (await readFile(join(homedir(), '.supabase-token'), 'utf8')).trim() || null
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return null
  }
}

async function main() {
  if (project !== QA_REF) throw new Error('Este comando solo aplica la migración al proyecto QA configurado.')
  const token = await managementToken()
  if (!token) throw new Error('Falta el token de gestión en el entorno, app/.env.supabase.local o ~/.supabase-token.')
  const query = async (sql) => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error(`La API de gestión rechazó la operación (HTTP ${response.status}).`)
    const data = await response.json()
    if (!Array.isArray(data)) throw new Error('La API no devolvió un resultado SQL válido.')
    return data
  }

  const preflight = await query("select to_regclass('public.gym_settings')::text as settings, to_regclass('storage.buckets')::text as buckets, to_regclass('storage.objects')::text as objects")
  if (!preflight[0]?.settings || !preflight[0]?.buckets || !preflight[0]?.objects) {
    throw new Error('El proyecto no tiene las tablas necesarias. No se ejecutó la migración.')
  }
  console.log(`Aplicando únicamente terms-documents.sql en QA (${project}).`)
  await query(await readFile(new URL('supabase/terms-documents.sql', root), 'utf8'))

  const columns = await query("select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'gym_settings' and column_name in ('terms_pdf_url', 'terms_version', 'terms_updated_at') order by column_name")
  const buckets = await query("select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'legal-documents'")
  const policies = await query("select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('terms upload admin', 'terms read admin', 'terms delete admin') order by policyname")
  const expected = { terms_pdf_url: 'text', terms_version: 'text', terms_updated_at: 'timestamp with time zone' }
  if (columns.length !== 3 || columns.some((column) => expected[column.column_name] !== column.data_type)) {
    throw new Error('La migración se ejecutó, pero la verificación de columnas no coincide.')
  }
  const bucket = buckets[0]
  if (!bucket?.public || Number(bucket.file_size_limit) !== 5242880 || JSON.stringify(bucket.allowed_mime_types) !== '["application/pdf"]') {
    throw new Error('La migración se ejecutó, pero el bucket no coincide con la configuración esperada.')
  }
  const commands = { 'terms upload admin': 'INSERT', 'terms read admin': 'SELECT', 'terms delete admin': 'DELETE' }
  if (policies.length !== 3 || policies.some((policy) => commands[policy.policyname] !== policy.cmd || !/admin/.test(`${policy.qual || ''} ${policy.with_check || ''}`))) {
    throw new Error('La migración se ejecutó, pero sus políticas requieren revisión.')
  }
  console.log(JSON.stringify({ project, columns, bucket, policies }, null, 2))
  console.log('Migración de TyC aplicada y verificada en QA.')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
