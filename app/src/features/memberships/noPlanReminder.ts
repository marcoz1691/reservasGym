const NO_PLAN_REMINDER_KEY = 'zc.no-plan-reminder.dismissed'

/** El socio cerró el recordatorio de plan. Solo dura esta sesión del navegador. */
export function markNoPlanReminderDismissed(): void {
  try {
    sessionStorage.setItem(NO_PLAN_REMINDER_KEY, '1')
  } catch {
    // Storage bloqueado: el recordatorio puede volver a aparecer.
  }
}

export function wasNoPlanReminderDismissed(): boolean {
  try {
    return sessionStorage.getItem(NO_PLAN_REMINDER_KEY) === '1'
  } catch {
    return false
  }
}
