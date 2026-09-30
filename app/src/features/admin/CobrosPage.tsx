import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  History,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react'
import {
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type {
  ManualPaymentMethod,
  Membership,
  MembershipPlan,
  Payment,
  User,
} from '@/domain/models'
import {
  computeMembershipStatus,
  daysRemaining,
  isNearExpiration,
} from '@/domain/rules/membership'
import {
  formatCurrency,
  formatDateShort,
  formatPaymentMethod,
  formatPaymentStatus,
} from '@/lib/format'
import { Badge, Button, Card, EmptyState, Input, PageHeader } from '@/ui/primitives'

type TabType = 'pos' | 'vencimientos' | 'historial'

interface ReceiptData {
  payment: Payment
  membership: Membership
  member: User
  plan: MembershipPlan
}

export function CobrosPage() {
  const repo = useRepo()
  const user = useCurrentUser()
  const refresh = useRefresh()

  const [activeTab, setActiveTab] = useState<TabType>('pos')

  // Data states
  const [members, setMembers] = useState<User[]>([])
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  // POS Form State
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('card_pos')
  const [amountUsd, setAmountUsd] = useState<string>('')
  const [reference, setReference] = useState<string>('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)

  // Expiration Filter state
  const [expirationFilter, setExpirationFilter] = useState<'all' | 'grace' | 'expired' | 'warning'>('all')
  const [expirationSearch, setExpirationSearch] = useState('')

  // Payments History Filter state
  const [historySearch, setHistorySearch] = useState('')
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>('all')

  // Load all required data
  const loadData = async () => {
    try {
      const [mems, pls, mships, pays] = await Promise.all([
        repo.listMembers(),
        repo.getMembershipPlans(),
        repo.listMemberships(),
        repo.listPayments(),
      ])
      setMembers(mems)
      setPlans(pls)
      setMemberships(mships)
      setPayments(pays)
    } catch (err) {
      console.error('Error loading cobros data:', err)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Auto-fill price when plan changes
  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    const plan = plans.find((p) => p.id === planId)
    if (plan) {
      setAmountUsd((plan.priceCents / 100).toFixed(2))
    }
  }

  // Find active plans
  const activePlans = useMemo(() => {
    return plans.filter((p) => p.active !== false)
  }, [plans])

  // Map of active membership by user ID
  const membershipByUser = useMemo(() => {
    const map = new Map<string, Membership>()
    for (const m of memberships) {
      const existing = map.get(m.userId)
      if (!existing) {
        map.set(m.userId, m)
      } else {
        const statusExisting = computeMembershipStatus(existing)
        const statusM = computeMembershipStatus(m)
        if (
          (statusM === 'active' && statusExisting !== 'active') ||
          (statusM === 'grace' && statusExisting === 'expired') ||
          new Date(m.endsAt).getTime() > new Date(existing.endsAt).getTime()
        ) {
          map.set(m.userId, m)
        }
      }
    }
    return map
  }, [memberships])

  // Selected member helper
  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) ?? null
  }, [members, selectedMemberId])

  const selectedMemberMembership = useMemo(() => {
    if (!selectedMemberId) return null
    return membershipByUser.get(selectedMemberId) ?? null
  }, [membershipByUser, selectedMemberId])

  // Search filtered members for POS picker
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return members
    const q = memberSearchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    )
  }, [members, memberSearchQuery])

  // Members list with expiration or grace status
  const expiringMembers = useMemo(() => {
    const now = new Date()
    return members
      .map((member) => {
        const m = membershipByUser.get(member.id)
        if (!m) {
          return {
            member,
            membership: null,
            status: 'none' as const,
            daysLeft: 0,
            planName: 'Sin membresía',
          }
        }
        const status = computeMembershipStatus(m, now)
        const isWarning = isNearExpiration(m, 7, now)
        const daysLeft = daysRemaining(m, now)
        const plan = plans.find((p) => p.id === m.planId)
        return {
          member,
          membership: m,
          status,
          isWarning,
          daysLeft,
          planName: plan?.name ?? 'Plan anterior',
          planId: m.planId,
        }
      })
      .filter((item) => {
        if (!item.membership) return false
        if (item.status === 'grace' || item.status === 'expired') return true
        if (item.status === 'active' && item.isWarning) return true
        return false
      })
      .filter((item) => {
        if (expirationFilter === 'grace') return item.status === 'grace'
        if (expirationFilter === 'expired') return item.status === 'expired'
        if (expirationFilter === 'warning') return item.status === 'active' && item.isWarning
        return true
      })
      .filter((item) => {
        if (!expirationSearch.trim()) return true
        const q = expirationSearch.toLowerCase()
        return (
          item.member.fullName.toLowerCase().includes(q) ||
          item.member.email.toLowerCase().includes(q)
        )
      })
  }, [members, membershipByUser, plans, expirationFilter, expirationSearch])

  // Count badges for expiring/grace/expired
  const expiringCount = useMemo(() => {
    const now = new Date()
    return members.filter((member) => {
      const m = membershipByUser.get(member.id)
      if (!m) return false
      const status = computeMembershipStatus(m, now)
      return status === 'grace' || status === 'expired' || isNearExpiration(m, 7, now)
    }).length
  }, [members, membershipByUser])

  // Filtered Payments History
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (historyMethodFilter !== 'all') {
        if (p.manualMethod !== historyMethodFilter && p.provider !== historyMethodFilter) {
          return false
        }
      }
      if (!historySearch.trim()) return true
      const q = historySearch.toLowerCase()
      const member = members.find((m) => m.id === p.userId)
      const plan = plans.find((pl) => pl.id === p.planId)
      return (
        member?.fullName.toLowerCase().includes(q) ||
        member?.email.toLowerCase().includes(q) ||
        plan?.name.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q) ||
        p.authorizationCode?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
  }, [payments, members, plans, historyMethodFilter, historySearch])

  // Metrics
  // Solo cuenta dinero cobrado: un pago en línea pendiente o rechazado no suma.
  const metrics = useMemo(() => {
    const approved = payments.filter((p) => p.status === 'approved')
    const totalCents = approved.reduce((sum, p) => sum + p.amountCents, 0)
    const cashCents = approved
      .filter((p) => p.manualMethod === 'cash')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const transferCents = approved
      .filter((p) => p.manualMethod === 'transfer')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const cardPosCents = approved
      .filter((p) => p.manualMethod === 'card_pos')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const onlineCents = approved
      .filter((p) => p.provider === 'pagomedios')
      .reduce((sum, p) => sum + p.amountCents, 0)

    return {
      totalUsd: totalCents / 100,
      cashUsd: cashCents / 100,
      transferUsd: transferCents / 100,
      cardPosUsd: cardPosCents / 100,
      onlineUsd: onlineCents / 100,
      totalTransactions: approved.length,
    }
  }, [payments])

  // Quick Action from Expiring list
  const handleQuickRenewal = (memberId: string, planId?: string) => {
    setSelectedMemberId(memberId)
    setMemberSearchQuery('')
    const targetPlan = activePlans.find((p) => p.id === planId) ?? activePlans[0]
    if (targetPlan) {
      handleSelectPlan(targetPlan.id)
    }
    setReceipt(null)
    setActiveTab('pos')
  }

  // Handle Submit POS Manual Payment
  const handleProcessPayment = async (e: FormEvent) => {
    e.preventDefault()
    setPaymentError(null)

    if (!selectedMemberId) {
      setPaymentError('Por favor selecciona un socio.')
      return
    }
    if (!selectedPlanId) {
      setPaymentError('Por favor selecciona un plan de membresía.')
      return
    }
    const numAmount = parseFloat(amountUsd)
    if (isNaN(numAmount) || numAmount <= 0) {
      setPaymentError('El monto debe ser mayor a 0.00 USD.')
      return
    }

    setProcessingPayment(true)

    try {
      const amountCents = Math.round(numAmount * 100)
      const res = await repo.registerManualPayment({
        userId: selectedMemberId,
        planId: selectedPlanId,
        amountCents,
        manualMethod: paymentMethod,
        reference: reference.trim() || undefined,
      })

      const targetMember = members.find((m) => m.id === selectedMemberId)
      const targetPlan = plans.find((p) => p.id === selectedPlanId)

      if (targetMember && targetPlan) {
        setReceipt({
          payment: res.payment,
          membership: res.membership,
          member: targetMember,
          plan: targetPlan,
        })
      }

      await refresh()
      await loadData()
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Error al registrar el cobro.')
    } finally {
      setProcessingPayment(false)
    }
  }

  const handleResetPosForm = () => {
    setSelectedMemberId('')
    setMemberSearchQuery('')
    setSelectedPlanId('')
    setAmountUsd('')
    setReference('')
    setPaymentError(null)
    setReceipt(null)
  }

  // Guard: Staff or Admin role only
  if (user && user.role === 'member') {
    return (
      <div className="py-12 text-center">
        <EmptyState
          title="Acceso restringido"
          description="Este módulo es exclusivo para el equipo de staff y administradores de Zona Cero."
          action={
            <Link to="/">
              <Button>Volver al inicio</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de Cobros & POS"
        subtitle="Cobros presenciales en caja, gestión de renovaciones y control de caja"
        action={
          <div className="flex items-center gap-2">
            <Link to="/admin">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Panel Admin
              </Button>
            </Link>
            {user?.role === 'admin' ? (
              <Link to="/admin/planes">
                <Button variant="secondary" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Gestionar Planes
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('pos')
          }}
          className={`focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
            activeTab === 'pos'
              ? 'bg-acc text-[var(--color-acc-contrast)] shadow-sm'
              : 'bg-surface text-ink-2 hover:bg-surface/80 hover:text-ink'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Registrar Cobro (POS)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('vencimientos')
          }}
          className={`focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
            activeTab === 'vencimientos'
              ? 'bg-acc text-[var(--color-acc-contrast)] shadow-sm'
              : 'bg-surface text-ink-2 hover:bg-surface/80 hover:text-ink'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Socios por Vencer y Vencidos
          {expiringCount > 0 ? (
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-black ${
                activeTab === 'vencimientos'
                  ? 'bg-black/15 text-[var(--color-acc-contrast)]'
                  : 'bg-warn/20 text-warn'
              }`}
            >
              {expiringCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('historial')
          }}
          className={`focus-ring inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
            activeTab === 'historial'
              ? 'bg-acc text-[var(--color-acc-contrast)] shadow-sm'
              : 'bg-surface text-ink-2 hover:bg-surface/80 hover:text-ink'
          }`}
        >
          <History className="h-4 w-4" />
          Historial General de Cobros
        </button>
      </div>

      {/* TAB 1: REGISTRAR COBRO (POS) */}
      {activeTab === 'pos' && (
        <div className="space-y-6">
          {payments.some((p) => p.status === 'pending' && p.provider === 'manual') ? (
            <Card className="space-y-3 p-5">
              <h2 className="text-lg font-extrabold text-ink">Solicitudes de socios</h2>
              <p className="text-xs text-ink-3">
                El socio ya eligió plan y forma de pago. Al cobrar, se activa su membresía.
              </p>
              <div className="grid gap-2">
                {payments
                  .filter((p) => p.status === 'pending' && p.provider === 'manual' && p.membershipId == null)
                  .map((payment) => {
                    const member = members.find((m) => m.id === payment.userId)
                    const plan = plans.find((p) => p.id === payment.planId)
                    return (
                      <button
                        key={payment.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(payment.userId)
                          setMemberSearchQuery('')
                          handleSelectPlan(payment.planId)
                          if (payment.manualMethod) setPaymentMethod(payment.manualMethod)
                          setReceipt(null)
                        }}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-bg px-4 py-3 text-left hover:border-acc"
                      >
                        <span>
                          <span className="block text-sm font-bold text-ink">
                            {member?.fullName ?? 'Socio'}
                          </span>
                          <span className="text-xs text-ink-3">
                            {plan?.name ?? 'Plan'} ·{' '}
                            {payment.manualMethod === 'cash'
                              ? 'Efectivo'
                              : payment.manualMethod === 'transfer'
                                ? 'Transferencia'
                                : 'Tarjeta Datafast'}
                          </span>
                        </span>
                        <span className="text-sm font-bold text-acc">Cobrar</span>
                      </button>
                    )
                  })}
              </div>
            </Card>
          ) : null}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main POS Form */}
          <div className="lg:col-span-2 space-y-6">
            {receipt ? (
              /* Success Receipt / Confirmation Banner */
              <Card className="border-acc/40 bg-acc/5 p-6 space-y-5">
                <div className="flex items-center gap-3 text-acc">
                  <CheckCircle2 className="h-7 w-7 shrink-0" />
                  <div>
                    <h2 className="text-xl font-extrabold text-ink">
                      ¡Cobro Registrado y Membresía Activada!
                    </h2>
                    <p className="text-xs text-ink-3">
                      Comprobante de transacción exitosa emitido para caja
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-bg-2 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between border-b border-line pb-3 gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
                        Comprobante de Pago
                      </span>
                      <div className="text-sm font-mono font-bold text-acc">
                        ID: {receipt.payment.id}
                      </div>
                    </div>
                    <Badge tone="ok">
                      {receipt.payment.status === 'approved' ? 'Aprobado' : receipt.payment.status}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-xs text-ink-3">Socio:</span>
                      <div className="font-bold text-ink">{receipt.member.fullName}</div>
                      <div className="text-xs text-ink-3">{receipt.member.email}</div>
                    </div>

                    <div>
                      <span className="text-xs text-ink-3">Plan Contratado:</span>
                      <div className="font-bold text-ink">{receipt.plan.name}</div>
                      <div className="text-xs text-ink-3">{receipt.plan.durationDays} días de vigencia</div>
                    </div>

                    <div>
                      <span className="text-xs text-ink-3">Monto Cobrado:</span>
                      <div className="text-xl font-black text-acc">
                        {formatCurrency(receipt.payment.amountCents)} USD
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-ink-3">Método de Pago:</span>
                      <div className="font-bold text-ink">
                        {formatPaymentMethod(receipt.payment.provider, receipt.payment.manualMethod)}
                      </div>
                      {receipt.payment.reference ? (
                        <div className="text-xs text-ink-3 font-mono">
                          Ref: {receipt.payment.reference}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-line pt-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-ink-3">Nueva Vigencia:</span>
                      <span className="font-bold text-ink">
                        {formatDateShort(receipt.membership.startsAt)} al{' '}
                        {formatDateShort(receipt.membership.endsAt)}
                      </span>
                    </div>
                    {receipt.membership.graceEndsAt ? (
                      <div className="flex justify-between">
                        <span className="text-ink-3">Periodo de Gracia hasta:</span>
                        <span className="font-bold text-warn">
                          {formatDateShort(receipt.membership.graceEndsAt)}
                        </span>
                      </div>
                    ) : null}
                    {receipt.membership.visitsLeft !== null ? (
                      <div className="flex justify-between">
                        <span className="text-ink-3">Visitas Disponibles:</span>
                        <span className="font-bold text-ink">
                          {receipt.membership.visitsLeft} visitas
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    variant="primary"
                    onClick={handleResetPosForm}
                    className="flex-1 gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Registrar Nuevo Cobro
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setActiveTab('historial')}
                    className="gap-2"
                  >
                    <History className="h-4 w-4" />
                    Ver en Historial
                  </Button>
                </div>
              </Card>
            ) : (
              <form onSubmit={handleProcessPayment} className="space-y-6">
                {/* 1. Seleccionar Socio */}
                <Card className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-ink flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-acc" />
                      1. Seleccionar Socio
                    </h3>
                    {selectedMember ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberId('')
                          setMemberSearchQuery('')
                        }}
                        className="text-xs font-bold text-acc hover:underline"
                      >
                        Cambiar socio
                      </button>
                    ) : null}
                  </div>

                  {!selectedMember ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-3" />
                        <Input
                          placeholder="Buscar por nombre o correo electrónico..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                        {memberSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => setMemberSearchQuery('')}
                            className="absolute right-3.5 top-3 text-ink-3 hover:text-ink"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      {/* Members selection dropdown/list */}
                      <div className="max-h-56 overflow-y-auto rounded-2xl border border-line divide-y divide-line bg-bg">
                        {filteredMembers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-ink-3">
                            No se encontraron socios con "{memberSearchQuery}".
                          </div>
                        ) : (
                          filteredMembers.map((m) => {
                            const curM = membershipByUser.get(m.id)
                            const curStatus = curM ? computeMembershipStatus(curM) : 'none'
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedMemberId(m.id)
                                  setMemberSearchQuery('')
                                  if (curM && curM.planId) {
                                    const prevPlan = activePlans.find((p) => p.id === curM.planId)
                                    if (prevPlan && !selectedPlanId) {
                                      handleSelectPlan(prevPlan.id)
                                    }
                                  }
                                }}
                                className="w-full flex items-center justify-between p-3 text-left hover:bg-surface/80 transition"
                              >
                                <div>
                                  <div className="font-bold text-ink text-sm">{m.fullName}</div>
                                  <div className="text-xs text-ink-3">{m.email}</div>
                                </div>
                                <div>
                                  {curStatus === 'active' && (
                                    <Badge tone="ok">Activa</Badge>
                                  )}
                                  {curStatus === 'grace' && (
                                    <Badge tone="warn">En gracia</Badge>
                                  )}
                                  {curStatus === 'expired' && (
                                    <Badge tone="danger">Vencida</Badge>
                                  )}
                                  {curStatus === 'none' && (
                                    <Badge tone="neutral">Sin plan</Badge>
                                  )}
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-line bg-surface/50 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-ink text-base">
                          {selectedMember.fullName}
                        </div>
                        <div className="text-xs text-ink-3">{selectedMember.email}</div>
                        {selectedMemberMembership ? (
                          <div className="mt-2 text-xs flex items-center gap-2">
                            <span className="text-ink-3">Estado actual:</span>
                            {computeMembershipStatus(selectedMemberMembership) === 'active' && (
                              <Badge tone="ok">
                                Activa hasta {formatDateShort(selectedMemberMembership.endsAt)}
                              </Badge>
                            )}
                            {computeMembershipStatus(selectedMemberMembership) === 'grace' && (
                              <Badge tone="warn">
                                En gracia hasta {formatDateShort(selectedMemberMembership.graceEndsAt ?? selectedMemberMembership.endsAt)}
                              </Badge>
                            )}
                            {computeMembershipStatus(selectedMemberMembership) === 'expired' && (
                              <Badge tone="danger">
                                Vencida el {formatDateShort(selectedMemberMembership.endsAt)}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-ink-3">
                            <Badge tone="neutral">Sin membresía previa registrada</Badge>
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setSelectedMemberId('')}
                        className="text-xs py-1.5 px-3"
                      >
                        Cambiar
                      </Button>
                    </div>
                  )}
                </Card>

                {/* 2. Seleccionar Plan */}
                <Card className="space-y-4">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-acc" />
                    2. Seleccionar Plan de Membresía
                  </h3>

                  {activePlans.length === 0 ? (
                    <div className="text-xs text-ink-3 p-4 text-center">
                      No hay planes activos configurados.{' '}
                      <Link to="/admin/planes" className="text-acc underline font-bold">
                        Crear un plan
                      </Link>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {activePlans.map((plan) => {
                        const isSelected = selectedPlanId === plan.id
                        return (
                          <div
                            key={plan.id}
                            onClick={() => handleSelectPlan(plan.id)}
                            className={`cursor-pointer rounded-2xl border p-4 transition ${
                              isSelected
                                ? 'border-acc bg-acc/10 ring-2 ring-acc/50'
                                : 'border-line bg-bg hover:border-acc/40 hover:bg-surface/50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-ink text-sm">{plan.name}</div>
                              <div className="text-base font-extrabold text-acc">
                                {formatCurrency(plan.priceCents)}
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink-3">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-acc" />
                                {plan.durationDays} días
                              </span>
                              <span>•</span>
                              <span>
                                {plan.visitQuota !== null
                                  ? `${plan.visitQuota} visitas`
                                  : 'Visitas ilimitadas'}
                              </span>
                            </div>

                            <div className="mt-2 text-[11px] text-ink-3">
                              {!plan.allowedZoneIds || plan.allowedZoneIds.length === 0
                                ? '✓ Acceso total a todas las áreas'
                                : `✓ ${plan.allowedZoneIds.length} áreas específicas permitidas`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>

                {/* 3. Método de Pago y Monto */}
                <Card className="space-y-4">
                  <h3 className="text-base font-bold text-ink flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-acc" />
                    3. Método de Pago y Monto (USD)
                  </h3>

                  {/* Payment method selector */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
                      Medio de Pago Presencial
                    </span>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card_pos')}
                        className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition ${
                          paymentMethod === 'card_pos'
                            ? 'border-acc bg-acc/10 text-acc font-bold'
                            : 'border-line bg-bg text-ink-2 hover:bg-surface'
                        }`}
                      >
                        <CreditCard className="h-5 w-5 mb-1 text-acc" />
                        <span className="text-xs">Datáfono POS Datafast</span>
                        <span className="text-[10px] text-ink-3">Tarjeta débito/crédito</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition ${
                          paymentMethod === 'cash'
                            ? 'border-acc bg-acc/10 text-acc font-bold'
                            : 'border-line bg-bg text-ink-2 hover:bg-surface'
                        }`}
                      >
                        <Banknote className="h-5 w-5 mb-1 text-acc" />
                        <span className="text-xs">Efectivo</span>
                        <span className="text-[10px] text-ink-3">Cobro en caja</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('transfer')}
                        className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition ${
                          paymentMethod === 'transfer'
                            ? 'border-acc bg-acc/10 text-acc font-bold'
                            : 'border-line bg-bg text-ink-2 hover:bg-surface'
                        }`}
                      >
                        <Building2 className="h-5 w-5 mb-1 text-acc" />
                        <span className="text-xs">Transferencia Bancaria</span>
                        <span className="text-[10px] text-ink-3">Banco / App</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount and Reference */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Monto a Cobrar (USD)"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amountUsd}
                      onChange={(e) => setAmountUsd(e.target.value)}
                      placeholder="0.00"
                      required
                    />

                    <Input
                      label="Referencia / # Voucher / Comprobante (Opcional)"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Ej: POS-9482, Lote 03 o Transf #1092"
                    />
                  </div>

                  {paymentError ? (
                    <div className="rounded-2xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {paymentError}
                    </div>
                  ) : null}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={processingPayment || !selectedMemberId || !selectedPlanId}
                    className="w-full py-3 text-base gap-2"
                  >
                    {processingPayment ? (
                      'Procesando cobro y activando...'
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" />
                        Confirmar Cobro y Activar Membresía ({amountUsd ? `$${amountUsd} USD` : '$0.00'})
                      </>
                    )}
                  </Button>
                </Card>
              </form>
            )}
          </div>

          {/* POS Quick Summary / Right Sidebar */}
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider text-ink-3">
                Resumen de Operación POS
              </h3>

              <div className="space-y-2 text-xs divide-y divide-line">
                <div className="flex justify-between py-1.5">
                  <span className="text-ink-3">Socio seleccionado:</span>
                  <span className="font-bold text-ink text-right">
                    {selectedMember ? selectedMember.fullName : 'Ninguno'}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-ink-3">Plan elegido:</span>
                  <span className="font-bold text-ink text-right">
                    {plans.find((p) => p.id === selectedPlanId)?.name ?? 'Ninguno'}
                  </span>
                </div>

                <div className="flex justify-between py-1.5">
                  <span className="text-ink-3">Medio de cobro:</span>
                  <span className="font-bold text-ink">
                    {paymentMethod === 'card_pos' && 'Datáfono POS'}
                    {paymentMethod === 'cash' && 'Efectivo'}
                    {paymentMethod === 'transfer' && 'Transferencia'}
                  </span>
                </div>

                <div className="flex justify-between py-2 text-sm">
                  <span className="font-bold text-ink">Total a cobrar:</span>
                  <span className="font-extrabold text-acc text-base">
                    ${amountUsd ? parseFloat(amountUsd || '0').toFixed(2) : '0.00'} USD
                  </span>
                </div>
              </div>
            </Card>

            {/* Quick stats mini card */}
            <Card className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-ink-3">Caja Hoy</h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-bg p-2.5">
                  <div className="text-[10px] text-ink-3">Total Recaudado</div>
                  <div className="text-lg font-black text-acc">
                    ${metrics.totalUsd.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-2xl bg-bg p-2.5">
                  <div className="text-[10px] text-ink-3">Cobros Registrados</div>
                  <div className="text-lg font-black text-ink">
                    {metrics.totalTransactions}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
        </div>
      )}

      {/* TAB 2: SOCIOS POR VENCER Y VENCIDOS */}
      {activeTab === 'vencimientos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExpirationFilter('all')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  expirationFilter === 'all'
                    ? 'bg-acc text-[var(--color-acc-contrast)]'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Todos con Aviso ({expiringCount})
              </button>
              <button
                type="button"
                onClick={() => setExpirationFilter('warning')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  expirationFilter === 'warning'
                    ? 'bg-warn text-ink'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Por Vencer (≤ 7 días)
              </button>
              <button
                type="button"
                onClick={() => setExpirationFilter('grace')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  expirationFilter === 'grace'
                    ? 'bg-warn text-ink'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                En Periodo de Gracia (3 días)
              </button>
              <button
                type="button"
                onClick={() => setExpirationFilter('expired')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  expirationFilter === 'expired'
                    ? 'bg-danger text-white'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Vencidos
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-3" />
              <Input
                placeholder="Filtrar socio por nombre..."
                value={expirationSearch}
                onChange={(e) => setExpirationSearch(e.target.value)}
                className="pl-9 py-1.5 text-xs"
              />
            </div>
          </div>

          {expiringMembers.length === 0 ? (
            <EmptyState
              title="No hay socios en esta categoría"
              description="No se encontraron socios con membresías por vencer, en periodo de gracia o vencidas según los filtros actuales."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {expiringMembers.map((item) => (
                <Card
                  key={item.member.id}
                  className="flex flex-col justify-between p-4 space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-ink text-sm">
                          {item.member.fullName}
                        </div>
                        <div className="text-xs text-ink-3">{item.member.email}</div>
                      </div>
                      <div>
                        {item.status === 'grace' && (
                          <Badge tone="warn">En Gracia</Badge>
                        )}
                        {item.status === 'expired' && (
                          <Badge tone="danger">Vencida</Badge>
                        )}
                        {item.status === 'active' && item.isWarning && (
                          <Badge tone="warn">
                            {item.daysLeft === 1
                              ? 'Vence mañana'
                              : `Vence en ${item.daysLeft} días`}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-bg p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-ink-3">Plan Actual:</span>
                        <span className="font-bold text-ink">{item.planName}</span>
                      </div>
                      {item.membership && (
                        <div className="flex justify-between">
                          <span className="text-ink-3">Fecha de Fin:</span>
                          <span className="font-mono text-ink">
                            {formatDateShort(item.membership.endsAt)}
                          </span>
                        </div>
                      )}
                      {item.membership?.graceEndsAt && item.status === 'grace' && (
                        <div className="flex justify-between">
                          <span className="text-ink-3">Fin de Gracia:</span>
                          <span className="font-mono text-warn font-bold">
                            {formatDateShort(item.membership.graceEndsAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => handleQuickRenewal(item.member.id, item.planId)}
                    className="w-full gap-2 text-xs py-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Cobrar Renovación
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORIAL GENERAL DE COBROS */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {/* Metrics summary cards */}
          <div className="grid gap-3 sm:grid-cols-5">
            <Card>
              <div className="text-[11px] font-bold uppercase text-ink-3">Total Recaudado</div>
              <div className="mt-1 text-2xl font-black text-acc">
                ${metrics.totalUsd.toFixed(2)} USD
              </div>
              <div className="text-[11px] text-ink-3 mt-1">
                {metrics.totalTransactions} cobros aprobados
              </div>
            </Card>

            <Card>
              <div className="text-[11px] font-bold uppercase text-ink-3">Datáfono POS</div>
              <div className="mt-1 text-2xl font-black text-ink">
                ${metrics.cardPosUsd.toFixed(2)} USD
              </div>
              <div className="text-[11px] text-ink-3 mt-1">Tarjetas Datafast</div>
            </Card>

            <Card>
              <div className="text-[11px] font-bold uppercase text-ink-3">Efectivo</div>
              <div className="mt-1 text-2xl font-black text-ink">
                ${metrics.cashUsd.toFixed(2)} USD
              </div>
              <div className="text-[11px] text-ink-3 mt-1">Caja física</div>
            </Card>

            <Card>
              <div className="text-[11px] font-bold uppercase text-ink-3">Transferencias</div>
              <div className="mt-1 text-2xl font-black text-ink">
                ${metrics.transferUsd.toFixed(2)} USD
              </div>
              <div className="text-[11px] text-ink-3 mt-1">Bancos acreditados</div>
            </Card>

            <Card>
              <div className="text-[11px] font-bold uppercase text-ink-3">En línea</div>
              <div className="mt-1 text-2xl font-black text-ink">
                ${metrics.onlineUsd.toFixed(2)} USD
              </div>
              <div className="text-[11px] text-ink-3 mt-1">Pagomedios</div>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHistoryMethodFilter('all')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  historyMethodFilter === 'all'
                    ? 'bg-acc text-[var(--color-acc-contrast)]'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Todos los métodos
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter('card_pos')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  historyMethodFilter === 'card_pos'
                    ? 'bg-acc text-[var(--color-acc-contrast)]'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Datáfono POS
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter('cash')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  historyMethodFilter === 'cash'
                    ? 'bg-acc text-[var(--color-acc-contrast)]'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Efectivo
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter('transfer')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  historyMethodFilter === 'transfer'
                    ? 'bg-acc text-[var(--color-acc-contrast)]'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                Transferencia
              </button>
              <button
                type="button"
                onClick={() => setHistoryMethodFilter('pagomedios')}
                className={`rounded-2xl px-3 py-1.5 text-xs font-bold transition ${
                  historyMethodFilter === 'pagomedios'
                    ? 'bg-acc text-[var(--color-acc-contrast)]'
                    : 'bg-surface text-ink-2 hover:bg-surface/80'
                }`}
              >
                En línea (Pagomedios)
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-3" />
              <Input
                placeholder="Buscar por socio, plan, ref..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Table / List */}
          {filteredPayments.length === 0 ? (
            <EmptyState
              title="No hay cobros registrados"
              description="No se encontraron transacciones en el historial que coincidan con la búsqueda."
            />
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-line bg-bg-2">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface/50 text-[11px] uppercase tracking-wider text-ink-3 font-bold">
                  <tr>
                    <th className="p-3.5">Fecha</th>
                    <th className="p-3.5">Socio</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Monto</th>
                    <th className="p-3.5">Método</th>
                    <th className="p-3.5">Referencia</th>
                    <th className="p-3.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPayments.map((pay) => {
                    const member = members.find((m) => m.id === pay.userId)
                    const plan = plans.find((p) => p.id === pay.planId)
                    return (
                      <tr key={pay.id} className="hover:bg-surface/40 transition">
                        <td className="p-3.5 whitespace-nowrap text-ink-3 font-mono">
                          {formatDateShort(pay.createdAt)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-ink">
                            {member ? member.fullName : pay.userId}
                          </div>
                          <div className="text-[10px] text-ink-3">
                            {member?.email}
                          </div>
                        </td>
                        <td className="p-3.5 font-medium text-ink">
                          {plan ? plan.name : pay.planId}
                        </td>
                        <td className="p-3.5 font-bold text-acc whitespace-nowrap text-sm">
                          {formatCurrency(pay.amountCents)}
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-ink">
                            {formatPaymentMethod(pay.provider, pay.manualMethod)}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-ink-3">
                          {pay.authorizationCode ? (
                            <div className="text-ink">Aut. {pay.authorizationCode}</div>
                          ) : null}
                          <div>{pay.reference || '—'}</div>
                        </td>
                        <td className="p-3.5">
                          <Badge
                            tone={
                              pay.status === 'approved'
                                ? 'ok'
                                : pay.status === 'pending'
                                ? 'warn'
                                : 'danger'
                            }
                          >
                            {formatPaymentStatus(pay.status)}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
