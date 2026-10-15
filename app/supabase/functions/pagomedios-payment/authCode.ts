/**
 * Código de autorización del banco (ZCAPP-72). Pagomedios lo devuelve al aprobar un cobro y
 * se guarda en payments.mp_payment_id, pero el banco lo repite entre transacciones. Mientras
 * la base tenga el índice único de mp_payment_id (hasta aplicar quitar-mercadopago-datafast.sql),
 * guardar un código repetido falla y el pago cobrado quedaría pendiente y sin membresía.
 */

/** unique_violation de Postgres. */
export const UNIQUE_VIOLATION = "23505"

type DbResult = { error: { code?: string; message: string } | null }

/**
 * Hace la escritura con el código; si choca con el índice único, la repite sin guardarlo.
 * `write("")` debe omitir el código.
 */
export async function writeWithAuthCode<R extends DbResult>(
  write: (authCode: string) => PromiseLike<R>,
  authCode: string,
  onRepeated?: (authCode: string) => void,
): Promise<R> {
  const first = await write(authCode)
  if (first.error?.code !== UNIQUE_VIOLATION || !authCode) return first
  onRepeated?.(authCode)
  return await write("")
}
