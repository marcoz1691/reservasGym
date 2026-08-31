import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { AppRouter } from './app/router'
import { ErrorBoundary } from './app/ErrorBoundary'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <RepositoryProvider>
          <AppRouter />
        </RepositoryProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
