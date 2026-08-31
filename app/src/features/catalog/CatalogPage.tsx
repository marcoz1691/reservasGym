import { Link } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { ZONE_TYPE_LABELS, type ZoneType } from '@/domain/models'
import { Badge, PageHeader } from '@/ui/primitives'

const ALL_TYPES = Object.keys(ZONE_TYPE_LABELS) as ZoneType[]

export function CatalogPage() {
  const state = useAppStore((s) => s.state)
  const zoneFilter = useAppStore((s) => s.zoneFilter)
  const setZoneFilter = useAppStore((s) => s.setZoneFilter)
  const zones =
    state?.zones.filter((z) => zoneFilter === 'all' || z.type === zoneFilter) ??
    []

  return (
    <div>
      <PageHeader
        title="Catálogo de áreas"
        subtitle="Las 8 áreas del paquete Intermedia."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Chip
          active={zoneFilter === 'all'}
          label="Todas"
          onClick={() => setZoneFilter('all')}
        />
        {ALL_TYPES.map((t) => (
          <Chip
            key={t}
            active={zoneFilter === t}
            label={ZONE_TYPE_LABELS[t]}
            onClick={() => setZoneFilter(t)}
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {zones.map((z) => {
          const sessionCount =
            state?.sessions.filter((s) => s.zoneId === z.id).length ?? 0
          return (
            <Link
              key={z.id}
              to={`/agenda?zone=${z.id}`}
              className="surface block overflow-hidden transition hover:-translate-y-0.5"
            >
              <div className="h-24 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-acc)] opacity-90" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{z.name}</h2>
                  <Badge>{ZONE_TYPE_LABELS[z.type]}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-ink-3)]">{z.description}</p>
                <p className="mt-3 text-xs text-[var(--color-ink-2)]">
                  Cupo base {z.defaultCapacity} · {sessionCount} sesiones
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        active
          ? 'bg-[var(--color-brand)] text-white'
          : 'bg-white/10 text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)]'
      }`}
    >
      {label}
    </button>
  )
}
