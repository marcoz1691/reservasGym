import { beforeEach, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { LEGAL_DOCUMENTS } from './legalDocuments'
import { LegalPage } from './LegalPage'

beforeEach(() => { localStorage.clear(); resetRepositoryForTests() })

it.each(LEGAL_DOCUMENTS)('permite leer $slug sin sesión', async (doc) => {
  render(<MemoryRouter initialEntries={['/legal/' + doc.slug]}>
    <RepositoryProvider><AppRouter /></RepositoryProvider>
  </MemoryRouter>)
  expect(await screen.findByRole('heading', { level: 1, name: doc.title })).toBeInTheDocument()
})

it('vuelve al login al abrir un enlace directo', async () => {
  render(<MemoryRouter initialEntries={['/legal/privacidad']}><Routes>
    <Route path="/legal/:slug" element={<LegalPage />} />
    <Route path="/login" element={<p>Login destino</p>} />
  </Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByText('Login destino')).toBeInTheDocument()
})

it('vuelve al perfil si existe una entrada anterior', async () => {
  render(<MemoryRouter initialEntries={['/perfil', '/legal/privacidad']} initialIndex={1}><Routes>
    <Route path="/legal/:slug" element={<LegalPage />} />
    <Route path="/perfil" element={<p>Perfil destino</p>} />
  </Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByText('Perfil destino')).toBeInTheDocument()
})
