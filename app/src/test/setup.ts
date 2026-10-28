import '@testing-library/jest-dom/vitest'
import { notifyManager } from '@tanstack/react-query'

// TanStack Query avisa a los componentes con setTimeout(0); en los tests se
// usa una microtarea para que los datos lleguen al mismo ritmo que el antiguo
// refresh() con setState (los tests esperan un texto y luego leen el resto).
notifyManager.setScheduler(queueMicrotask)
