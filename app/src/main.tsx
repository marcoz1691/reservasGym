import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { installSpanishFormValidation } from '@/lib/formValidationEs'
import { AppRouter } from './app/router'
import { ErrorBoundary } from './app/ErrorBoundary'
import './index.css'

/** Vite `base` (e.g. `/` or `/reservasGym/`) → React Router basename */
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

installSpanishFormValidation()

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
