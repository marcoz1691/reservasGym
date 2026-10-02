import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MembershipPlan } from '@/domain/models'
import { PlansShowcase } from './PlansShowcase'

function plan(
  partial: Pick<MembershipPlan, 'id' | 'name' | 'priceCents' | 'durationDays'> &
    Partial<MembershipPlan>,
): MembershipPlan {
  return {
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
    ...partial,
  }
}

const catalog: MembershipPlan[] = [
  plan({ id: 's30', name: 'Zero Start Mensual', priceCents: 1500, durationDays: 30 }),
  plan({ id: 's90', name: 'Zero Start Trimestral', priceCents: 3825, durationDays: 90 }),
  plan({ id: 's210', name: 'Zero Start Semestral', priceCents: 9000, durationDays: 210 }),
  plan({ id: 's420', name: 'Zero Start Anual', priceCents: 18000, durationDays: 420 }),
  plan({
    id: 'e420',
    name: 'Zero Elite Anual',
    priceCents: 90000,
    durationDays: 420,
  }),
]

describe('PlansShowcase', () => {
  it('muestra familias, meses gratis y no lista todas las tarifas a la vez', async () => {
    const user = userEvent.setup()
    render(<PlansShowcase plans={catalog} zones={[]} onChoosePlan={() => undefined} />)

    expect(screen.getByRole('tab', { name: 'Zero Start' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Zero Elite' })).toBeInTheDocument()
    expect(screen.getByText('Clases funcionales en gimnasio')).toBeInTheDocument()
    expect(screen.getByText('1 mes gratis')).toBeInTheDocument()
    expect(screen.getByText('2 meses gratis')).toBeInTheDocument()
    expect(screen.getByLabelText('3 meses · 15% off')).toBeInTheDocument()
    expect(screen.getByText('−15%')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Elegir este plan' })).toHaveLength(4)
    expect(screen.queryByText(/1. Elige tu plan/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Complejo completo, todas las áreas')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Zero Elite' }))
    expect(screen.getByText('Complejo completo, todas las áreas')).toBeInTheDocument()
    expect(screen.getByText('2 meses gratis')).toBeInTheDocument()
    expect(screen.getByText('Más ahorro')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Elegir este plan' })).toHaveLength(1)
  })

  it('tacha el precio de lista y calcula el ahorro desde la tarifa mensual', async () => {
    const user = userEvent.setup()
    render(<PlansShowcase plans={catalog} zones={[]} onChoosePlan={() => undefined} />)

    // Trimestral: 3 × $15.00 de lista = $45.00 frente a $38.25 reales
    expect(screen.getByText('$45.00')).toBeInTheDocument()
    expect(screen.getByText('Ahorras $6.75')).toBeInTheDocument()
    // Semestral (7 meses) y anual (14 meses) sobre la misma referencia
    expect(screen.getByText('Ahorras $15.00')).toBeInTheDocument()
    expect(screen.getByText('Ahorras $30.00')).toBeInTheDocument()
    // El plan mensual es la referencia: no se tacha a sí mismo
    expect(screen.queryByText('Ahorras $0.00')).not.toBeInTheDocument()

    // Zero Elite no tiene tarifa mensual en el catálogo: sin referencia, sin tachado
    await user.click(screen.getByRole('tab', { name: 'Zero Elite' }))
    expect(screen.queryByText(/^Ahorras /)).not.toBeInTheDocument()
  })

  it('con plan activo marca el siguiente nivel como mejora', async () => {
    const user = userEvent.setup()
    render(
      <PlansShowcase
        plans={catalog}
        zones={[]}
        currentPlanId="s30"
        onChoosePlan={() => undefined}
      />,
    )

    expect(screen.getByText(/Un nivel arriba de Zero Start Mensual/)).toBeInTheDocument()
    expect(screen.getByText('Tu plan actual')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plan actual' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Ver este nivel' }))
    expect(screen.getByRole('button', { name: 'Mejorar plan' })).toBeInTheDocument()
    expect(screen.getByText('Mejorar')).toBeInTheDocument()
  })

  it('con pago en línea, un socio con plan puede elegir cualquier plan (no solo renovar o mejorar)', async () => {
    const user = userEvent.setup()
    const paid: string[] = []
    render(
      <PlansShowcase
        plans={catalog}
        zones={[]}
        currentPlanId="s30"
        onlinePayEnabled
        onPayOnline={(id) => void paid.push(id)}
      />,
    )

    expect(screen.getByRole('button', { name: /Renovar plan/ })).toBeInTheDocument()
    // Start Mensual (actual) + Trimestral, Semestral y Anual de la misma familia
    expect(screen.getAllByRole('button', { name: /Renovar plan|Mejorar plan|Elegir plan/ })).toHaveLength(4)
    expect(screen.getAllByText('Tarjeta, efectivo o transferencia')).toHaveLength(4)

    await user.click(screen.getAllByRole('button', { name: /Elegir plan/ })[0]!)
    expect(paid).toEqual(['s90'])

    await user.click(screen.getByRole('tab', { name: 'Zero Elite' }))
    expect(screen.getByRole('button', { name: /Mejorar plan|Elegir plan/ })).toBeInTheDocument()
  })
})
