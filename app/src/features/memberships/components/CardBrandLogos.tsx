/**
 * Marcas de aceptación de las tarjetas que procesa Pagomedios, dibujadas en
 * SVG (sin depender de imágenes externas). Solo indican qué tarjetas se aceptan.
 */
const BADGE = 'h-7 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-white'

function Visa() {
  return (
    <svg viewBox="0 0 44 28" className={BADGE} role="img" aria-label="Visa">
      <text x="22" y="18.5" textAnchor="middle" fontSize="11" fontWeight="800" fontStyle="italic" fontFamily="Arial, sans-serif" fill="#1A1F71">
        VISA
      </text>
    </svg>
  )
}

function Mastercard() {
  return (
    <svg viewBox="0 0 44 28" className={BADGE} role="img" aria-label="Mastercard">
      <circle cx="18" cy="14" r="7.5" fill="#EB001B" />
      <circle cx="26" cy="14" r="7.5" fill="#F79E1B" />
      <path d="M22 8.1a7.5 7.5 0 0 1 0 11.8 7.5 7.5 0 0 1 0-11.8z" fill="#FF5F00" />
    </svg>
  )
}

function Diners() {
  return (
    <svg viewBox="0 0 44 28" className={BADGE} role="img" aria-label="Diners Club">
      <circle cx="22" cy="14" r="8" fill="#0079BE" />
      <circle cx="22" cy="14" r="5.6" fill="#fff" />
      <rect x="20.2" y="8.4" width="3.6" height="11.2" fill="#0079BE" />
    </svg>
  )
}

function Discover() {
  return (
    <svg viewBox="0 0 44 28" className={BADGE} role="img" aria-label="Discover">
      <text x="5" y="17.5" fontSize="6.6" fontWeight="800" fontFamily="Arial, sans-serif" fill="#231F20">
        DISC
      </text>
      <circle cx="25.6" cy="15.3" r="2.9" fill="#F48120" />
      <text x="28.8" y="17.5" fontSize="6.6" fontWeight="800" fontFamily="Arial, sans-serif" fill="#231F20">
        VER
      </text>
    </svg>
  )
}

function Amex() {
  return (
    <svg viewBox="0 0 44 28" className={BADGE} role="img" aria-label="American Express">
      <rect width="44" height="28" fill="#2E77BC" />
      <text x="22" y="12.6" textAnchor="middle" fontSize="6.2" fontWeight="800" fontFamily="Arial, sans-serif" fill="#fff">
        AMERICAN
      </text>
      <text x="22" y="20.4" textAnchor="middle" fontSize="6.2" fontWeight="800" fontFamily="Arial, sans-serif" fill="#fff">
        EXPRESS
      </text>
    </svg>
  )
}

export function CardBrandLogos() {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Tarjetas aceptadas" role="group">
      <Visa />
      <Mastercard />
      <Diners />
      <Discover />
      <Amex />
    </div>
  )
}
