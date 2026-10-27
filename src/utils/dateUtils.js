export const BUSINESS_TIME_ZONE = 'Asia/Kolkata'

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

function pad(value) {
  return String(value).padStart(2, '0')
}

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function parseDateKey(value) {
  if (!isValidDateKey(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getKolkataParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = {}
  parts.forEach((part) => {
    if (part.type !== 'literal') values[part.type] = part.value
  })

  const hour = Number(values.hour)
  const minute = Number(values.minute)

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute,
    second: Number(values.second),
    minutesOfDay: hour * 60 + minute,
  }
}

export function todayKey(date = new Date()) {
  return getKolkataParts(date).dateKey
}

export function daysBetween(fromKey, toKey) {
  const from = parseDateKey(fromKey)
  const to = parseDateKey(toKey)
  if (!from || !to) return null
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toUtc - fromUtc) / DAY_MS)
}

export function daysRemaining(expiryDate, referenceDate = todayKey()) {
  return daysBetween(referenceDate, expiryDate)
}

export function addDaysToKey(dateKey, amount) {
  const date = parseDateKey(dateKey)
  if (!date) return null
  const num = Number(amount)
  if (Number.isNaN(num)) return dateKey
  date.setDate(date.getDate() + num)
  return toDateKey(date)
}

export function formatDateKey(dateKey, options = {}) {
  const date = parseDateKey(dateKey)
  if (!date) return '—'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  })
}

export function formatDateTime(value, options = {}) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

export function formatTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('en-IN', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getExpiryMeta(expiryDate, referenceDate = todayKey()) {
  if (!expiryDate) {
    return {
      days: null,
      status: 'none',
      label: 'No expiry',
      tone: 'slate',
    }
  }

  const days = daysRemaining(expiryDate, referenceDate)
  if (days === null) {
    return {
      days: null,
      status: 'none',
      label: 'Invalid date',
      tone: 'slate',
    }
  }

  if (days < 0) {
    const overdue = Math.abs(days)
    return {
      days,
      status: 'expired',
      label: `Expired ${overdue} day${overdue === 1 ? '' : 's'} ago`,
      shortLabel: 'Expired',
      tone: 'red',
    }
  }

  if (days === 0) {
    return {
      days,
      status: 'today',
      label: 'Expires today',
      shortLabel: 'Today',
      tone: 'red',
    }
  }

  if (days <= 5) {
    return {
      days,
      status: 'soon',
      label: `${days} day${days === 1 ? '' : 's'} left`,
      shortLabel: `${days}d left`,
      tone: 'amber',
    }
  }

  return {
    days,
    status: 'safe',
    label: `${days} days left`,
    shortLabel: 'Safe',
    tone: 'green',
  }
}

export function formatDaysRemaining(days) {
  if (days === null || days === undefined) return '—'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  return `${days} day${days === 1 ? '' : 's'}`
}

export function parseNotificationTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    return { hour: 10, minute: 30 }
  }
  const [hour, minute] = value.split(':').map(Number)
  if (hour > 23 || minute > 59) return { hour: 10, minute: 30 }
  return { hour, minute }
}

export function formatNotificationTime(value) {
  const { hour, minute } = parseNotificationTime(value)
  const date = new Date(2026, 0, 1, hour, minute)
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function getNextScheduleInfo(notificationTime, lastCheckedDate = null, date = new Date()) {
  const now = getKolkataParts(date)
  const { hour, minute } = parseNotificationTime(notificationTime)
  const targetMinutes = hour * 60 + minute
  const checkedToday = lastCheckedDate === now.dateKey
  const dueNow = !checkedToday && now.minutesOfDay >= targetMinutes

  let targetDateKey = now.dateKey
  let relative = 'today'

  if (checkedToday || now.minutesOfDay >= targetMinutes) {
    targetDateKey = addDaysToKey(now.dateKey, 1)
    relative = 'tomorrow'
  }

  return {
    dateKey: targetDateKey,
    time: notificationTime,
    formattedTime: formatNotificationTime(notificationTime),
    dueNow,
    relative,
    label: dueNow
      ? 'Due now'
      : relative === 'today'
        ? `Today, ${formatNotificationTime(notificationTime)}`
        : relative === 'tomorrow'
          ? `Tomorrow, ${formatNotificationTime(notificationTime)}`
          : `${formatDateKey(targetDateKey)}, ${formatNotificationTime(notificationTime)}`,
  }
}

export function isScheduledTimeReached(notificationTime, date = new Date()) {
  const now = getKolkataParts(date)
  const { hour, minute } = parseNotificationTime(notificationTime)
  return now.minutesOfDay >= hour * 60 + minute
}

export function getWeekStartKey(dateKey) {
  const date = parseDateKey(dateKey)
  if (!date) return null
  const weekday = date.getDay()
  const offset = weekday === 0 ? 6 : weekday - 1
  date.setDate(date.getDate() - offset)
  return toDateKey(date)
}

export function getMonthStartKey(dateKey) {
  const date = parseDateKey(dateKey)
  if (!date) return null
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function getPeriodKey(dateKey, grouping) {
  if (grouping === 'weekly') return getWeekStartKey(dateKey)
  if (grouping === 'monthly') return dateKey?.slice(0, 7)
  return dateKey
}

export function getPeriodLabel(periodKey, grouping) {
  if (!periodKey) return '—'
  if (grouping === 'monthly') {
    const [year, month] = periodKey.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    })
  }
  if (grouping === 'weekly') {
    const start = formatDateKey(periodKey, { year: undefined })
    const end = formatDateKey(addDaysToKey(periodKey, 6), { year: undefined })
    return `${start} – ${end}`
  }
  return formatDateKey(periodKey)
}

export function getMonthKey(date = new Date()) {
  return todayKey(date).slice(0, 7)
}

export function minutesFromTimeString(value) {
  const { hour, minute } = parseNotificationTime(value)
  return hour * 60 + minute
}
