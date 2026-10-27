import { UNIT_OPTIONS } from './constants'
import { daysRemaining } from './dateUtils'

export function round2(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round((number + Number.EPSILON) * 100) / 100
}

export function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function formatCurrency(value, options = {}) {
  const amount = toNumber(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

export function getUnitOption(unit) {
  return UNIT_OPTIONS.find((option) => option.value === unit) || UNIT_OPTIONS[4]
}

export function unitShort(unit) {
  return getUnitOption(unit).short
}

export function formatWeightValue(packageWeight, unit) {
  if (packageWeight === null || packageWeight === undefined || packageWeight === '') {
    return '—'
  }
  return `${formatNumber(packageWeight)} ${unitShort(unit)}`
}

export function formatQuantity(value, unit) {
  return `${formatNumber(value)} ${unitShort(unit)}`
}

export function calcLineTotal(quantity, rate) {
  return round2(toNumber(quantity) * toNumber(rate))
}

export function calcInvoiceTotals(items, discount = 0) {
  const subtotal = round2(
    (items || []).reduce(
      (total, item) => total + toNumber(item.quantity) * toNumber(item.rate),
      0,
    ),
  )
  const safeDiscount = Math.min(Math.max(toNumber(discount), 0), subtotal)
  return {
    subtotal,
    discount: round2(safeDiscount),
    grandTotal: round2(subtotal - safeDiscount),
  }
}

export function getStockStatus(currentStock, openingStock = null) {
  const stock = toNumber(currentStock)
  if (stock <= 0) {
    return { status: 'out', label: 'Out of stock', tone: 'red' }
  }
  const threshold =
    openingStock === null || openingStock === undefined
      ? 5
      : Math.max(3, Math.round(toNumber(openingStock) * 0.2))
  if (stock <= threshold) {
    return { status: 'low', label: 'Low stock', tone: 'amber' }
  }
  return { status: 'in', label: 'In stock', tone: 'green' }
}

export function getSellableQuantity(productId, batches, referenceDate) {
  const productBatches = (batches || []).filter(
    (batch) => batch.productId === productId && toNumber(batch.quantity) > 0,
  )

  return productBatches.reduce((total, batch) => {
    if (!batch.expiryDate) return total + toNumber(batch.quantity)
    const days = daysRemaining(batch.expiryDate, referenceDate)
    if (days !== null && days < 0) return total
    return total + toNumber(batch.quantity)
  }, 0)
}

export function getExpiredQuantity(productId, batches, referenceDate) {
  return (batches || [])
    .filter((batch) => batch.productId === productId && toNumber(batch.quantity) > 0)
    .reduce((total, batch) => {
      const days = batch.expiryDate ? daysRemaining(batch.expiryDate, referenceDate) : null
      return days !== null && days < 0 ? total + toNumber(batch.quantity) : total
    }, 0)
}

export function sumBy(items, selector) {
  return round2((items || []).reduce((total, item) => total + toNumber(selector(item)), 0))
}

export function groupBy(items, selector) {
  return (items || []).reduce((groups, item) => {
    const key = selector(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}

export function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function clamp(value, min, max) {
  return Math.min(Math.max(toNumber(value, min), min), max)
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}
