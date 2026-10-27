import { daysRemaining, getExpiryMeta, todayKey } from '../utils/dateUtils'
import { toNumber } from '../utils/calculations'
import { getBatches, getProducts } from './storageService'

function toEntry(batch, product, referenceDate) {
  const days = batch.expiryDate ? daysRemaining(batch.expiryDate, referenceDate) : null
  const meta = getExpiryMeta(batch.expiryDate, referenceDate)

  return {
    batchId: batch.id,
    productId: product.id,
    productName: product.productName,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    packageWeight: product.packageWeight,
    quantity: toNumber(batch.quantity),
    batchNumber: batch.batchNumber || '—',
    manufacturingDate: batch.manufacturingDate || null,
    expiryDate: batch.expiryDate,
    daysRemaining: days,
    status: meta.status,
    alertStatus:
      meta.status === 'expired'
        ? 'Expired'
        : meta.status === 'today'
          ? 'Expires today'
          : meta.status === 'soon'
            ? `${days} day${days === 1 ? '' : 's'} left`
            : meta.status === 'safe'
              ? 'Safe'
              : 'No expiry',
    label: meta.label,
    tone: meta.tone,
  }
}

function sortByExpiry(a, b) {
  const expiryCompare = String(a.expiryDate || '').localeCompare(String(b.expiryDate || ''))
  if (expiryCompare !== 0) return expiryCompare
  return String(a.productName).localeCompare(String(b.productName))
}

function distinctProductCount(entries) {
  return new Set(entries.map((entry) => entry.productId)).size
}

export function getExpirySnapshot(
  referenceDate = todayKey(),
  { products = getProducts(), batches = getBatches() } = {},
) {
  const productMap = new Map(products.map((product) => [product.id, product]))
  const productIdsWithBatches = new Set(batches.map((batch) => batch.productId))

  const entries = batches
    .map((batch) => {
      const product = productMap.get(batch.productId)
      return product ? toEntry(batch, product, referenceDate) : null
    })
    .filter(Boolean)

  products.forEach((product) => {
    if (productIdsWithBatches.has(product.id)) return
    if (!product.expiryDate || toNumber(product.currentStock) <= 0) return
    entries.push(
      toEntry(
        {
          id: null,
          quantity: product.currentStock,
          expiryDate: product.expiryDate,
          manufacturingDate: product.manufacturingDate,
          batchNumber: '—',
        },
        product,
        referenceDate,
      ),
    )
  })

  const withStock = entries.filter((entry) => entry.quantity > 0 && entry.expiryDate)
  const expiring = withStock
    .filter((entry) => entry.daysRemaining >= 0 && entry.daysRemaining <= 5)
    .sort((a, b) => {
      if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining
      return String(a.productName).localeCompare(String(b.productName))
    })
  const expiringToday = expiring.filter((entry) => entry.daysRemaining === 0)
  const expired = withStock
    .filter((entry) => entry.daysRemaining < 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
  const safe = withStock.filter((entry) => entry.daysRemaining > 5)
  const all = entries.filter((entry) => entry.expiryDate).sort(sortByExpiry)

  return {
    referenceDate,
    expiring,
    expiringToday,
    expired,
    safe,
    all,
    counts: {
      expiringBatches: expiring.length,
      expiringProducts: distinctProductCount(expiring),
      expiringTodayBatches: expiringToday.length,
      expiringTodayProducts: distinctProductCount(expiringToday),
      expiredBatches: expired.length,
      expiredProducts: distinctProductCount(expired),
      safeBatches: safe.length,
      allBatches: all.length,
    },
  }
}

export function aggregateProductsForEmail(entries) {
  const groups = new Map()

  entries.forEach((entry) => {
    if (!groups.has(entry.productId)) {
      groups.set(entry.productId, {
        productId: entry.productId,
        productName: entry.productName,
        sku: entry.sku,
        unit: entry.unit,
        packageWeight: entry.packageWeight,
        quantity: 0,
        expiryDate: entry.expiryDate,
        daysRemaining: entry.daysRemaining,
        batchNumbers: [],
      })
    }

    const group = groups.get(entry.productId)
    group.quantity += toNumber(entry.quantity)
    if (
      !group.expiryDate ||
      String(entry.expiryDate) < String(group.expiryDate)
    ) {
      group.expiryDate = entry.expiryDate
      group.daysRemaining = entry.daysRemaining
    }
    if (entry.batchNumber && entry.batchNumber !== '—') {
      group.batchNumbers.push(entry.batchNumber)
    }
  })

  return [...groups.values()].sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining
    return String(a.productName).localeCompare(String(b.productName))
  })
}

export function getEmailSnapshot(referenceDate = todayKey(), data) {
  const snapshot = getExpirySnapshot(referenceDate, data)
  return {
    ...snapshot,
    expiringProducts: aggregateProductsForEmail(snapshot.expiring),
    expiredProducts: aggregateProductsForEmail(snapshot.expired),
  }
}

export function getProductExpiryInfo(product, batches, referenceDate = todayKey()) {
  const productBatches = (batches || []).filter(
    (batch) => batch.productId === product.id && toNumber(batch.quantity) > 0,
  )
  if (!productBatches.length) {
    return {
      ...getExpiryMeta(product.expiryDate, referenceDate),
      expiryDate: product.expiryDate,
      batchCount: 0,
    }
  }

  const earliest = [...productBatches].sort((a, b) =>
    String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')),
  )[0]

  return {
    ...getExpiryMeta(earliest.expiryDate, referenceDate),
    expiryDate: earliest.expiryDate,
    batchCount: productBatches.length,
  }
}
