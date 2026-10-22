import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { formatDateSpanish } from '@/lib/format'
import { LEGAL_DOCUMENTS, legalPath } from './legalDocuments'

/**
 * Documentos legales públicos (sin sesión): términos, privacidad, reembolsos y
 * almacenamiento local. Las tiendas piden una URL pública de la política de privacidad.
 */
export function LegalPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { slug } = useParams()
  const doc = LEGAL_DOCUMENTS.find((d) => d.slug === slug)

  if (!doc) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-black text-ink">Documento no encontrado</h1>
        <LegalLinks />
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-bg">
      <article className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-10">
        <button type="button" onClick={() => { if ((window.history.state?.idx ?? 0) > 0 || location.key !== 'default') navigate(-1); else navigate('/login', { replace: true }) }} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver
        </button>
        <header className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-acc-dark">Zona Cero Performance Center</p>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{doc.title}</h1>
          <p className="text-xs text-ink-3">
            Versión {doc.version} · actualizada el {formatDateSpanish(`${doc.updatedAt}T12:00:00-05:00`)}
          </p>
        </header>
        {doc.sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-base font-bold text-ink">{section.title}</h2>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-2">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <footer className="border-t border-line pt-4">
          <LegalLinks current={doc.slug} />
        </footer>
      </article>
    </main>
  )
}

/** Enlaces a los documentos legales, para el pie del login, el perfil y cada documento. */
export function LegalLinks({ current, className = '' }: { current?: string; className?: string }) {
  return (
    <nav aria-label="Documentos legales" className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${className}`}>
      {LEGAL_DOCUMENTS.filter((d) => d.slug !== current).map((d) => (
        <Link key={d.slug} to={legalPath(d)} className="inline-flex min-h-8 items-center font-semibold text-ink-3 underline hover:text-ink">
          {d.title}
        </Link>
      ))}
    </nav>
  )
}
