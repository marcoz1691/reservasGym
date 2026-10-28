import { afterEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'

const MESSAGE = 'Sin conexión. Algunas acciones no están disponibles.'

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

describe('aviso sin conexión', () => {
  afterEach(() => setOnline(true))

  it('con conexión no muestra el aviso', () => {
    setOnline(true)
    render(<OfflineBanner />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('aparece al perder la conexión y se va al recuperarla', () => {
    setOnline(true)
    render(<OfflineBanner />)

    act(() => setOnline(false))
    expect(screen.getByRole('status')).toHaveTextContent(MESSAGE)

    act(() => setOnline(true))
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })
})
