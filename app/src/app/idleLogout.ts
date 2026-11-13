import { useEffect } from 'react'
import { idleLimitMs, isIdleExpired } from '@/domain/rules'
import type { User } from '@/domain/models'

const ACTIVITY_KEY = 'zc.staffLastActivity'
const LOGOUT_NOTICE_KEY = 'zc.idleLogout'
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
const CHECK_EVERY_MS = 15_000
const WRITE_THROTTLE_MS = 10_000

type ActivityRecord = { userId: string; at: number }

function readRecord(): ActivityRecord | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY)
    return raw ? (JSON.parse(raw) as ActivityRecord) : null
  } catch {
    return null
  }
}

function writeRecord(record: ActivityRecord) {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(record))
  } catch {
    // Sin almacenamiento (modo privado): el control sigue con el reloj en memoria.
  }
}

export function clearStaffActivity() {
  try {
    localStorage.removeItem(ACTIVITY_KEY)
  } catch {
    // nada que limpiar
  }
}

/** La pantalla de login lo muestra para explicar por qué se cerró la sesión. */
export function hasIdleLogoutNotice(): boolean {
  return idleLogoutNoticeMinutes() !== null
}

/** Minutos del límite que cerró la sesión (para el texto del aviso), o null si no hubo cierre. */
export function idleLogoutNoticeMinutes(): number | null {
  try {
    const raw = sessionStorage.getItem(LOGOUT_NOTICE_KEY)
    if (!raw) return null
    const minutes = Number(raw)
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 30
  } catch {
    return null
  }
}

export function clearIdleLogoutNotice() {
  try {
    sessionStorage.removeItem(LOGOUT_NOTICE_KEY)
  } catch {
    // nada que limpiar
  }
}

/**
 * Cierra la sesión tras un rato sin tocar la app (admin y recepción 30 min, socio 5 min;
 * ver IDLE_LIMIT_MINUTES). La última actividad
 * se guarda en el dispositivo, así que también cuenta el tiempo con la app cerrada o en
 * segundo plano (al volver se revisa de inmediato).
 */
export function useIdleLogout(user: User | null, signOut: () => Promise<void>) {
  const userId = user?.id ?? null
  const limitMs = idleLimitMs(user?.role)

  useEffect(() => {
    if (!userId || !limitMs) return

    let lastWrite = 0
    let loggingOut = false
    let lastActivity = Date.now()

    const stored = readRecord()
    if (stored && stored.userId === userId) {
      lastActivity = stored.at
    } else {
      writeRecord({ userId, at: lastActivity })
    }

    const expireIfIdle = () => {
      if (loggingOut || !isIdleExpired(lastActivity, Date.now(), limitMs)) return false
      loggingOut = true
      clearStaffActivity()
      try {
        sessionStorage.setItem(LOGOUT_NOTICE_KEY, String(Math.round(limitMs / 60000)))
      } catch {
        // el aviso es opcional
      }
      void signOut()
      return true
    }

    const onActivity = () => {
      if (expireIfIdle()) return
      lastActivity = Date.now()
      if (lastActivity - lastWrite >= WRITE_THROTTLE_MS) {
        lastWrite = lastActivity
        writeRecord({ userId, at: lastActivity })
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') expireIfIdle()
    }

    if (expireIfIdle()) return

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = window.setInterval(expireIfIdle, CHECK_EVERY_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(timer)
    }
  }, [userId, limitMs, signOut])
}
