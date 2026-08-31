import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { scopeGymState } from '../data/scopeGymState'
import { createSeedState, DEMO_PASSWORD } from '../data/seed'
import { LocalRepository } from '../data/localRepository'
import { resetRepositoryForTests } from '../data/repository'

describe('Security Audit & Zero Secret Leaks (Cero Fuga de Secretos)', () => {
  const appDir = path.resolve(__dirname, '../..')
  const srcDir = path.resolve(__dirname, '..')
  const distDir = path.resolve(appDir, 'dist')

  it('verifies .env.example contains only safe, public variables and zero private secrets', () => {
    const envExamplePath = path.resolve(appDir, '.env.example')
    expect(fs.existsSync(envExamplePath)).toBe(true)

    const envContent = fs.readFileSync(envExamplePath, 'utf-8')
    const lines = envContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))

    // Must only declare VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
    const varNames = lines.map((l) => l.split('=')[0]?.trim()).filter(Boolean)
    for (const name of varNames) {
      expect(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']).toContain(name)
    }

    // Must NOT contain any service role or private keys
    expect(envContent).not.toMatch(/service_role/i)
    expect(envContent).not.toMatch(/secret/i)
    expect(envContent).not.toMatch(/private_key/i)
  })

  it('verifies client source code contains zero private API keys, service role keys, or payment private secrets', () => {
    const forbiddenPatterns = [
      /SUPABASE_SERVICE_ROLE_KEY/i,
      /service_role_key/i,
      /serviceRoleKey/i,
      /DATAFAST_SECRET/i,
      /MERCADOPAGO_ACCESS_TOKEN/i,
      /STRIPE_SECRET_KEY/i,
      /PRIVATE_KEY/i,
    ]

    function scanDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.tmp') {
            scanDirectory(fullPath)
          }
        } else if (
          (entry.name.endsWith('.ts') ||
            entry.name.endsWith('.tsx') ||
            entry.name.endsWith('.js') ||
            entry.name.endsWith('.json')) &&
          !entry.name.includes('securityAudit.test.ts')
        ) {
          const content = fs.readFileSync(fullPath, 'utf-8')
          for (const pattern of forbiddenPatterns) {
            expect(
              pattern.test(content),
              `Forbidden pattern ${pattern} found in ${fullPath}`,
            ).toBe(false)
          }
        }
      }
    }

    scanDirectory(srcDir)
  })

  it('verifies vite.config.ts and capacitor.config.ts do not expose private credentials', () => {
    const viteConfigPath = path.resolve(appDir, 'vite.config.ts')
    const capConfigPath = path.resolve(appDir, 'capacitor.config.ts')

    const viteContent = fs.readFileSync(viteConfigPath, 'utf-8')
    const capContent = fs.readFileSync(capConfigPath, 'utf-8')

    for (const content of [viteContent, capContent]) {
      expect(content).not.toMatch(/service_role/i)
      expect(content).not.toMatch(/secret/i)
      expect(content).not.toMatch(/private_key/i)
      expect(content).not.toMatch(/password/i)
    }
  })

  it('verifies production build dist/ assets bundle does not leak private keys or secrets', () => {
    if (!fs.existsSync(distDir)) {
      return // skipped if build not yet run
    }

    const assetsDir = path.resolve(distDir, 'assets')
    if (!fs.existsSync(assetsDir)) return

    const files = fs.readdirSync(assetsDir)
    const jsFiles = files.filter((f) => f.endsWith('.js'))

    expect(jsFiles.length).toBeGreaterThan(0)

    for (const jsFile of jsFiles) {
      const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8')

      // Check for dangerous keywords in client bundles
      expect(jsContent).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
      expect(jsContent).not.toMatch(/service_role_key/)
      expect(jsContent).not.toMatch(/DATAFAST_SECRET/)
      expect(jsContent).not.toMatch(/MERCADOPAGO_ACCESS_TOKEN/)
      expect(jsContent).not.toMatch(/STRIPE_SECRET_KEY/)
    }
  })

  it('ensures scopeGymState prevents peer PII leakage for members (Defense-in-depth)', () => {
    const seed = createSeedState()
    const memberActor = seed.users.find((u) => u.role === 'member')!

    const scopedState = scopeGymState(seed, memberActor)

    // Member can only see their own user record
    expect(scopedState.users.length).toBe(1)
    expect(scopedState.users[0]!.id).toBe(memberActor.id)

    // Member can only see their own bookings
    expect(scopedState.bookings.every((b) => b.userId === memberActor.id)).toBe(true)

    // Member can only see their own body measurements
    expect(scopedState.measurements.every((m) => m.userId === memberActor.id)).toBe(true)

    // Member can only see their own memberships and payments
    expect(scopedState.memberships.every((m) => m.userId === memberActor.id)).toBe(true)
    expect(scopedState.payments.every((p) => p.userId === memberActor.id)).toBe(true)

    // Unauthenticated actor sees zero personal data
    const anonState = scopeGymState(seed, null)
    expect(anonState.users).toEqual([])
    expect(anonState.bookings).toEqual([])
    expect(anonState.measurements).toEqual([])
    expect(anonState.memberships).toEqual([])
    expect(anonState.payments).toEqual([])
  })

  it('ensures session isolation and unauthenticated tamper protection in LocalRepository', async () => {
    localStorage.clear()
    resetRepositoryForTests()

    const repo = new LocalRepository()
    const user = await repo.signIn({
      email: 'socio@gym.local',
      password: DEMO_PASSWORD,
    })

    expect(user.role).toBe('member')

    // Tampering with localStorage session with fake user ID without matching secret token fails
    localStorage.setItem(
      'reservasgym.session.v2',
      JSON.stringify({ userId: 'user_admin', token: 'invalid_forged_token' }),
    )

    const forgedRepo = new LocalRepository()
    expect(await forgedRepo.getCurrentUser()).toBeNull()
  })
})
