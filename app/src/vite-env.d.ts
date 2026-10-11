/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Extra de contrato. '1' muestra Face ID / huella. */
  readonly VITE_BIOMETRICS?: string
  /** '1' habilita el pago en línea. */
  readonly VITE_ONLINE_PAYMENTS?: string
  /** '1' ofrece el pago recurrente mensual (Pagomedios, Adenda N.º 1). */
  readonly VITE_RECURRING_PAYMENTS?: string
  /** 'pagomedios' (default) | 'datafast' */
  readonly VITE_PAYMENT_PROVIDER?: string
  /** Solo dev: URL de pagomedios-payment corriendo con Deno (simulador local). */
  readonly VITE_FUNCTIONS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
