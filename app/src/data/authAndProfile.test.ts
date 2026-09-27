import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'
import { resetRepositoryForTests } from './repository'
import { DEMO_PASSWORD } from './seed'

describe('Auth and Profile expanded flows', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('registers user with expanded health and profile fields', async () => {
    const repo = new LocalRepository()
    const user = await repo.signUp({
      fullName: 'Carlos Deportista',
      email: 'carlos@test.com',
      password: 'password123',
      birthDate: '1990-05-15',
      residence: 'Quito, Cumbayá',
      heightCm: 180,
      initialWeightKg: 78.5,
      goals: 'Preparación Hyrox y ganancia muscular',
      healthNotes: 'Sin antecedentes de lesiones',
    })

    expect(user.fullName).toBe('Carlos Deportista')
    expect(user.email).toBe('carlos@test.com')
    expect(user.birthDate).toBe('1990-05-15')
    expect(user.residence).toBe('Quito, Cumbayá')
    expect(user.heightCm).toBe(180)
    expect(user.initialWeightKg).toBe(78.5)
    expect(user.goals).toBe('Preparación Hyrox y ganancia muscular')
    expect(user.healthNotes).toBe('Sin antecedentes de lesiones')

    // Verifies initial weight measurement was automatically recorded
    const measurements = await repo.listMeasurements(user.id)
    expect(measurements.length).toBe(1)
    expect(measurements[0]!.weightKg).toBe(78.5)
    expect(measurements[0]!.userId).toBe(user.id)
  })

  it('updates member profile fields', async () => {
    const repo = new LocalRepository()
    await repo.signUp({
      fullName: 'Elena Gómez',
      email: 'elena@test.com',
      password: 'password123',
    })

    const updated = await repo.updateProfile({
      fullName: 'Elena Gómez M.',
      birthDate: '1992-08-20',
      residence: 'Tumbaco',
      heightCm: 168,
      goals: 'Tonificación y salud cardiovascular',
      healthNotes: 'Molestia leve en muñeca derecha',
    })

    expect(updated.fullName).toBe('Elena Gómez M.')
    expect(updated.birthDate).toBe('1992-08-20')
    expect(updated.residence).toBe('Tumbaco')
    expect(updated.heightCm).toBe(168)
    expect(updated.goals).toBe('Tonificación y salud cardiovascular')
    expect(updated.healthNotes).toBe('Molestia leve en muñeca derecha')

    const current = await repo.getCurrentUser()
    expect(current?.fullName).toBe('Elena Gómez M.')
    expect(current?.heightCm).toBe(168)
  })

  it('handles password recovery request without throwing', async () => {
    const repo = new LocalRepository()
    await repo.signUp({
      fullName: 'Pedro Test',
      email: 'pedro@test.com',
      password: 'password123',
    })

    await expect(repo.resetPassword('pedro@test.com')).resolves.not.toThrow()
    await expect(repo.resetPassword('inexistente@test.com')).resolves.not.toThrow()
  })

  it('permanently deletes account and personal data (Apple 5.1.1(v) & Google Data Safety)', async () => {
    const repo = new LocalRepository()
    const user = await repo.signUp({
      fullName: 'Usuario Borrar',
      email: 'borrar@test.com',
      password: 'password123',
      initialWeightKg: 75,
    })

    // Reservar exige membresía vigente: recepción registra el pago, como en la vida real.
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    await repo.registerManualPayment({
      userId: user.id,
      planId: 'plan-mensual-full',
      amountCents: 4500,
      manualMethod: 'cash',
    })
    await repo.signIn({ email: 'borrar@test.com', password: 'password123' })
    expect(await repo.getMemberMembership(user.id)).not.toBeNull()

    // Book a session
    const sessions = await repo.listSessions()
    expect(sessions.length).toBeGreaterThan(0)
    await repo.createBooking(sessions[0]!.id, user.id)

    const bookingsBefore = await repo.listBookingsForUser(user.id)
    expect(bookingsBefore.length).toBe(1)

    const measurementsBefore = await repo.listMeasurements(user.id)
    expect(measurementsBefore.length).toBe(1)

    // Execute permanent account deletion
    await repo.deleteAccount()

    // Session is cleared
    const currentUser = await repo.getCurrentUser()
    expect(currentUser).toBeNull()

    // User is completely removed from repository
    const allMembers = await repo.listMembers()
    expect(allMembers.some((m) => m.id === user.id)).toBe(false)

    // Membership and payments are gone too
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    expect((await repo.listMemberships()).some((m) => m.userId === user.id)).toBe(false)

    // Attempting to sign in with deleted account fails
    await expect(
      repo.signIn({ email: 'borrar@test.com', password: 'password123' }),
    ).rejects.toThrow(/no encontrado/i)
  })
})
