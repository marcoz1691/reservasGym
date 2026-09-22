/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Extra de contrato. '1' muestra Face ID / huella. */
  readonly VITE_BIOMETRICS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
