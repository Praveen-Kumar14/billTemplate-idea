import { getNextScheduleInfo, isScheduledTimeReached, todayKey } from '../utils/dateUtils'
import { EMAIL_RESULT_EVENT } from '../utils/constants'
import { getSettings, saveSettings } from './storageService'
import { getEmailConfigStatus, sendExpiryAlert } from './emailService'

let checkInProgress = false

function emitResult(result) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EMAIL_RESULT_EVENT, { detail: result }))
}

export function getSchedulerStatus(settings = getSettings()) {
  const config = getEmailConfigStatus(settings)
  const next = getNextScheduleInfo(
    settings.notificationTime,
    settings.lastScheduledCheckDate,
  )
  const enabled = Boolean(settings.notificationsEnabled)

  return {
    enabled,
    configured: config.configured,
    missing: config.missing,
    nextRunLabel: enabled ? next.label : 'Paused',
    nextRunDateKey: next.dateKey,
    dueNow: next.dueNow,
    lastScheduledAlertDate: settings.lastScheduledAlertDate,
    lastScheduledCheckDate: settings.lastScheduledCheckDate,
    lastScheduledResult: settings.lastScheduledResult,
    notificationTime: settings.notificationTime,
  }
}

export async function checkScheduledAlert() {
  if (checkInProgress) {
    return { ran: false, reason: 'in-progress' }
  }

  const settings = getSettings()
  if (!settings.notificationsEnabled) {
    return { ran: false, reason: 'disabled' }
  }

  const config = getEmailConfigStatus(settings)
  if (!config.configured) {
    return { ran: false, reason: 'not-configured' }
  }

  const currentDateKey = todayKey()
  if (settings.lastScheduledCheckDate === currentDateKey) {
    return { ran: false, reason: 'already-checked-today' }
  }

  if (!isScheduledTimeReached(settings.notificationTime)) {
    return { ran: false, reason: 'before-scheduled-time', nextCheck: getSchedulerStatus(settings) }
  }

  checkInProgress = true
  try {
    const result = await sendExpiryAlert({ settings, type: 'scheduled' })
    const patch = {
      lastScheduledCheckDate: currentDateKey,
      lastScheduledResult: {
        status: result.status,
        message: result.message,
        productCount: result.productCount || 0,
        at: new Date().toISOString(),
      },
    }
    if (result.status === 'success') {
      patch.lastScheduledAlertDate = currentDateKey
    }
    saveSettings(patch)
    emitResult({ ...result, scheduledFor: currentDateKey })
    return { ran: true, result }
  } catch (error) {
    const message =
      error?.message || 'The scheduled expiry alert could not be completed.'
    const patch = {
      lastScheduledCheckDate: currentDateKey,
      lastScheduledResult: {
        status: 'failed',
        message,
        productCount: 0,
        at: new Date().toISOString(),
      },
    }
    saveSettings(patch)
    const failed = { status: 'failed', message }
    emitResult({ ...failed, scheduledFor: currentDateKey })
    return { ran: true, result: failed }
  } finally {
    checkInProgress = false
  }
}
