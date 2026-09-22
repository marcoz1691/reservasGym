/**
 * Face ID / huella está desarrollado, pero no entra en el contrato base.
 * Permanece oculto hasta venderlo como extra: VITE_BIOMETRICS=1
 * En QA (vite --mode staging) nunca se muestra, aunque el extra esté encendido.
 */
export function isBiometricAccessEnabled(
  env: { MODE?: string; VITE_BIOMETRICS?: string } = import.meta.env,
): boolean {
  if (env.MODE === 'staging') return false
  return env.VITE_BIOMETRICS === '1'
}
