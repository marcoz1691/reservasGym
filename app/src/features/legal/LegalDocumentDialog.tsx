import { X } from 'lucide-react'
import { Button } from '@/ui/primitives'
import type { LegalDocument } from './legalDocuments'

/** Un documento legal en una ventana, sin salir del formulario (no se pierde lo escrito). */
export function LegalDocumentDialog({ doc, onClose }: { doc: LegalDocument; onClose: () => void }) {
  const titleId = `legal-${doc.slug}-title`
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-bg-2 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {doc.title}
            </h2>
            <p className="text-xs text-ink-3">Versión {doc.version}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Cerrar ${doc.title.toLowerCase()}`}
            className="rounded-xl p-1.5 text-ink-3 transition hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ink-2">
          {doc.sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="font-bold text-ink">{section.title}</h3>
              {section.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
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
