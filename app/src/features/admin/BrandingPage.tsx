import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAppData,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import { applyBrandColors } from '@/lib/format'
import { Button, Card, Input, PageHeader } from '@/ui/primitives'

export function BrandingPage() {
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()
  const [name, setName] = useState(data.settings.name)
  const [logoUrl, setLogoUrl] = useState(data.settings.logoUrl ?? '')
  const [accentColor, setAccentColor] = useState(data.settings.accentColor)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setName(data.settings.name)
    setLogoUrl(data.settings.logoUrl ?? '')
    setAccentColor(data.settings.accentColor)
  }, [data.settings])

  return (
    <div>
      <PageHeader
        title="Marca del gym"
        subtitle="Nombre, logo y color de acento"
        action={
          <Link to="/admin">
            <Button variant="ghost">Volver al admin</Button>
          </Link>
        }
      />
      {msg ? <p className="mb-3 text-sm text-acc">{msg}</p> : null}

      <Card className="max-w-lg space-y-4">
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void (async () => {
              try {
                const settings = await repo.updateSettings({
                  name: name.trim() || data.settings.name,
                  logoUrl: logoUrl.trim() || null,
                  accentColor: accentColor || data.settings.accentColor,
                })
                applyBrandColors(settings.primaryColor, settings.accentColor)
                await refresh()
                setMsg('Marca actualizada')
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'Error')
              }
            })()
          }}
        >
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="URL del logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
              Color de acento
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor || '#F26D17'}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-surface-elevated"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="font-mono"
              />
            </div>
          </label>

          <div
            className="rounded-2xl border border-line p-4"
            style={{ borderColor: accentColor }}
          >
            <p className="text-xs font-bold uppercase text-ink-3">Vista previa</p>
            <p className="mt-1 text-xl font-extrabold">{name || 'Nombre'}</p>
            <div
              className="mt-3 inline-flex rounded-2xl px-4 py-2 text-sm font-bold text-[var(--color-acc-contrast)] shadow-md"
              style={{ background: accentColor }}
            >
              Botón de ejemplo
            </div>
          </div>

          <Button type="submit">Guardar marca</Button>
        </form>
      </Card>
    </div>
  )
}
