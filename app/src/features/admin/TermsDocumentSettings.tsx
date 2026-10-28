import { useRef, useState, type FormEvent } from 'react'
import type { GymSettings } from '@/domain/models'
import type { GymRepository } from '@/data/types'
import { resolveTermsDocument } from '@/domain/rules/termsDocument'
import { Button, Card, Input } from '@/ui/primitives'

export function TermsDocumentSettings({ settings, repo, onPublished }: {
  settings: GymSettings
  repo: GymRepository
  onPublished: () => Promise<void>
}) {
  const document = resolveTermsDocument(settings, import.meta.env.BASE_URL)
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const submitting = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  async function publish(e: FormEvent) {
    e.preventDefault()
    if (submitting.current) return
    if (!file) {
      setMessage({ error: true, text: 'Selecciona un archivo PDF.' })
      return
    }
    submitting.current = true
    setSaving(true)
    setMessage(null)
    try {
      if (!repo.publishTermsPdf) throw new Error('La carga de documentos no está disponible.')
      await repo.publishTermsPdf(file, version.trim())
      await onPublished()
      setFile(null)
      setVersion('')
      if (input.current) input.current.value = ''
      setMessage({ error: false, text: 'Términos y condiciones publicados' })
    } catch (err) {
      setMessage({ error: true, text: err instanceof Error ? err.message : 'No se pudo publicar el PDF.' })
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  async function restoreDefault() {
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setMessage(null)
    try {
      await repo.updateSettings({ termsPdfUrl: null, termsVersion: null, termsUpdatedAt: null })
      await onPublished()
      setMessage({ error: false, text: 'Se usa el documento incluido de Zona Cero' })
    } catch (err) {
      setMessage({ error: true, text: err instanceof Error ? err.message : 'No se pudo cambiar el documento.' })
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Card className="mt-6 max-w-lg space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Términos y condiciones</h2>
        <p className="text-sm text-ink-2">Versión publicada: {document.version}</p>
        <a href={document.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline">
          Abrir PDF publicado
        </a>
        <p className="text-xs text-ink-3">El documento aparece en el pago. Publica un PDF de hasta 5 MB e identifica su versión.</p>
      </div>
      <form onSubmit={(e) => void publish(e)} className="space-y-3">
        <label className="block space-y-1.5 text-sm text-ink-2">
          <span>PDF de términos y condiciones</span>
          <input ref={input} type="file" accept="application/pdf,.pdf" disabled={saving}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-xl border border-line p-3 text-sm" />
        </label>
        <Input label="Versión del documento" value={version} maxLength={40} placeholder="Ej. 1.1" disabled={saving}
          onChange={(e) => setVersion(e.target.value)} />
        {message ? <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-danger' : 'text-acc-dark'}`}>{message.text}</p> : null}
        <Button type="submit" disabled={saving}>{saving ? 'Publicando…' : 'Publicar PDF'}</Button>
        {document.custom ? <Button type="button" variant="ghost" disabled={saving} onClick={() => void restoreDefault()}>Usar documento incluido</Button> : null}
      </form>
    </Card>
  )
}
