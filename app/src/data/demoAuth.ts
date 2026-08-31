/** Demo / local-only credential helpers (not a substitute for server auth). */

export async function hashSecret(secret: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${secret}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

export async function verifySecret(
  secret: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const actual = await hashSecret(secret, salt)
  return actual === expected
}

export function newSalt(): string {
  return crypto.randomUUID()
}

export function newSessionToken(): string {
  return crypto.randomUUID()
}
