import { X } from 'lucide-react'
import { formatDateSpanish } from '@/lib/format'
import { Button } from '@/ui/primitives'
import { TERMS } from './termsContent'
import type { GymSettings } from '@/domain/models'
import { resolveTermsDocument } from '@/domain/rules/termsDocument'

/** Términos y condiciones en una ventana, sin salir del pago (no se pierde lo escrito). */
export function TermsDialog({ onClose, settings }: { onClose: () => void; settings?: Pick<GymSettings, 'termsPdfUrl' | 'termsVersion' | 'termsUpdatedAt'> }) {
  const document = resolveTermsDocument(settings, import.meta.env.BASE_URL)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-bg-2 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="terms-title" className="text-lg font-bold text-ink">
              {TERMS.title}
            </h2>
            <p className="text-xs text-ink-3">Versión {document.version}</p>
            {document.updatedAt ? (
              <p className="text-xs text-ink-3">Publicado el {formatDateSpanish(document.updatedAt)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar términos y condiciones"
            className="rounded-xl p-1.5 text-ink-3 transition hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ink-2">
          <div className="flex flex-wrap gap-3">
            <a href={document.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-ink underline">Abrir PDF para imprimir</a>
            <a href={document.url} target="_blank" rel="noopener noreferrer" download="Terminos-Condiciones-Zona-Cero.pdf" className="inline-flex min-h-11 items-center font-semibold text-ink underline">Descargar PDF</a>
          </div>
          {document.custom ? (
            <p>Consulta el PDF publicado para leer las condiciones de esta versión. Al abrirlo conservas los datos de tu formulario de pago.</p>
          ) : TERMS.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h3 className="font-bold text-ink">{section.title}</h3>
              {section.paragraphs.map((paragraph, i) => <p key={i} className="text-justify [hyphens:auto]">{paragraph}</p>)}
            </section>
          ))}
        </div>
        <div className="border-t border-line px-5 py-4">
          <Button type="button" className="w-full" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  )
}
