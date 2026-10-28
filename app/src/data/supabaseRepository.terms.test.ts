import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@/domain/models'
import { SupabaseRepository } from './supabaseRepository'

function setup(role: User['role'] = 'admin', settingsError: string | null = null) {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn().mockResolvedValue({ error: null })
  const bucket = { upload, remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://qa.supabase.co/storage/v1/object/public/legal-documents/${path}` } }) }
  let patch: Record<string, unknown> = {}
  const chain = {
    update: vi.fn((value) => { patch = value; return chain }),
    eq: vi.fn(() => chain), select: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: {
      name: 'Zona Cero', logo_url: null, primary_color: '#111111', accent_color: '#ffffff',
      booking_window_hours: 24, cancel_window_hours: 2, check_in_window_minutes: 15, ...patch,
    }, error: settingsError ? { message: settingsError } : null })),
  }
  const client = { storage: { from: vi.fn(() => bucket) }, from: vi.fn(() => chain) } as unknown as SupabaseClient
  const repo = new SupabaseRepository(client)
  vi.spyOn(repo, 'getCurrentUser').mockResolvedValue({ id: 'u1', email: 'u@test.com', fullName: 'Usuario', role, createdAt: '' })
  return { repo, upload, remove, chain }
}

const pdf = () => new File(['%PDF-1.7\n'], 'terms.pdf', { type: 'application/pdf' })

describe('publicación remota del PDF de términos', () => {
  it('sube un archivo nuevo y persiste su URL, versión y fecha', async () => {
    const { repo, upload } = setup()
    const settings = await repo.publishTermsPdf(pdf(), '1.1')
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^terms\/.+\.pdf$/), expect.any(File), { contentType: 'application/pdf', upsert: false })
    expect(settings).toMatchObject({ termsVersion: '1.1', termsPdfUrl: expect.stringContaining('/legal-documents/terms/'), termsUpdatedAt: expect.any(String) })
  })

  it.each(['staff', 'member'] as const)('bloquea la subida por el rol %s antes de acceder al almacenamiento', async (role) => {
    const { repo, upload } = setup(role)
    await expect(repo.publishTermsPdf(pdf(), '1.1')).rejects.toThrow('Solo admin')
    expect(upload).not.toHaveBeenCalled()
  })

  it('si guardar la configuración falla, limpia el archivo nuevo y propaga el error', async () => {
    const { repo, remove, upload } = setup('admin', 'No se pudo publicar')
    await expect(repo.publishTermsPdf(pdf(), '1.1')).rejects.toThrow('No se pudo publicar')
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]])
  })

  it('si la subida falla, no cambia la configuración anterior', async () => {
    const { repo, upload, chain } = setup()
    upload.mockResolvedValue({ error: { message: 'Sin espacio' } })
    await expect(repo.publishTermsPdf(pdf(), '1.1')).rejects.toThrow('Sin espacio')
    expect(chain.update).not.toHaveBeenCalled()
  })
})
