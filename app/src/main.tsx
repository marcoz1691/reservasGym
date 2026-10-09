import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { installSpanishFormValidation } from '@/lib/formValidationEs'
import { AppRouter } from './app/router'
import { ErrorBoundary } from './app/ErrorBoundary'
import { installAndroidBackButton } from './app/androidBackButton'
// Fuentes empaquetadas con la app (sin red en Capacitor). Solo latin y los pesos en uso.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import './index.css'

/**
 * Vite `base` (e.g. `/` or `/reservasGym/`) → React Router basename.
 * En Capacitor la base es relativa (`./`) y la app vive en la raíz: sin basename.
 */
const base = import.meta.env.BASE_URL
const routerBasename = base.startsWith('/') ? base.replace(/\/$/, '') || undefined : undefined

installSpanishFormValidation()
void installAndroidBackButton()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        <RepositoryProvider>
          <AppRouter />
        </RepositoryProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
