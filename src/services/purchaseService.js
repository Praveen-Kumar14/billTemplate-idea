import { isValidDateKey, todayKey } from '../utils/dateUtils'
import { calcLineTotal, toNumber } from '../utils/calculations'
import { nextId } from '../utils/id'
import {
  getBatches,
  getProducts,
  getPurchases,
  setBatches,
  setProducts,
  setPurchases,
} from './storageService'
import { syncProductsWithBatches } from './productService'

function compactDate(dateKey) {
  return String(dateKey || '').replaceAll('-', '')
}

export function generatePurchaseInvoiceNumber(dateKey = todayKey()) {
  const purchases = getPurchases()
  const prefix = `PINV-${compactDate(dateKey)}-`
  const max = purchases.reduce((current, purchase) => {
    if (!String(purchase.invoiceNumber || '').startsWith(prefix)) return current
    const match = String(purchase.invoiceNumber).match(/-(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export function validatePurchase(input, purchases = getPurchases(), products = getProducts()) {
  const errors = {}
  const lineErrors = []
  const invoiceNumber = String(input.invoiceNumber || '').trim()
  const purchaseDate = input.purchaseDate || ''
  const supplierName = String(input.supplierName || '').trim()
  const items = Array.isArray(input.items) ? input.items : []

  if (!invoiceNumber) errors.invoiceNumber = 'Invoice number is required.'
  if (!isValidDateKey(purchaseDate)) errors.purchaseDate = 'Enter a valid purchase date.'
  if (!supplierName) errors.supplierName = 'Supplier name is required.'

  const duplicateInvoice = purchases.find(
    (purchase) =>
      String(purchase.invoiceNumber || '').trim().toLowerCase() ===
      invoiceNumber.toLowerCase(),
  )
  if (!errors.invoiceNumber && duplicateInvoice) {
    errors.invoiceNumber = 'This purchase invoice number already exists.'
  }

  if (!items.length) errors.items = 'Add at least one product to the purchase.'

  items.forEach((item, index) => {
    const lineError = {}
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) lineError.productId = 'Select a product.'
    if (toNumber(item.quantity) <= 0) lineError.quantity = 'Quantity must be greater than zero.'
    if (toNumber(item.rate) < 0) lineError.rate = 'Rate cannot be negative.'
    if (!item.expiryDate) {
      lineError.expiryDate = 'Expiry date is required.'
    } else if (!isValidDateKey(item.expiryDate)) {
      lineError.expiryDate = 'Enter a valid expiry date.'
    }
    if (item.manufacturingDate && !isValidDateKey(item.manufacturingDate)) {
      lineError.manufacturingDate = 'Enter a valid manufacturing date.'
    }
    if (
      item.manufacturingDate &&
      item.expiryDate &&
      item.manufacturingDate >= item.expiryDate
    ) {
      lineError.expiryDate = 'Expiry must be later than manufacturing date.'
    }
    lineErrors[index] = lineError
  })

  return { errors, lineErrors }
}

export function createPurchase(input) {
  const purchases = getPurchases()
  const products = getProducts()
  const batches = getBatches()
  const { errors, lineErrors } = validatePurchase(input, purchases, products)

  const hasLineErrors = lineErrors.some((line) => Object.keys(line).length > 0)
  if (Object.keys(errors).length || hasLineErrors) {
    return { ok: false, errors, lineErrors }
  }

  const now = new Date().toISOString()
  const invoiceNumber = String(input.invoiceNumber).trim()
  const purchaseDate = input.purchaseDate
  const supplierName = String(input.supplierName).trim()

  const nextBatches = [...batches]
  const newPurchases = []
  let purchaseCounter = purchases.length

  input.items.forEach((item, index) => {
    const product = products.find((entry) => entry.id === item.productId)
    const quantity = toNumber(item.quantity)
    const rate = toNumber(item.rate)
    purchaseCounter += 1

    const batch = {
      id: nextId('BATCH', nextBatches),
      productId: product.id,
      batchNumber:
        String(item.batchNumber || '').trim() ||
        `B-${product.sku}-${compactDate(purchaseDate)}-${index + 1}`,
      quantity,
      manufacturingDate: item.manufacturingDate || null,
      expiryDate: item.expiryDate,
      source: 'purchase',
      purchaseInvoice: invoiceNumber,
      createdAt: now,
    }
    nextBatches.push(batch)

    newPurchases.push({
      id: `PUR-${String(purchaseCounter).padStart(3, '0')}`,
      invoiceNumber,
      purchaseDate,
      supplierName,
      productId: product.id,
      productName: product.productName,
      sku: product.sku,
      unit: product.unit,
      packageWeight: product.packageWeight,
      quantity,
      rate,
      lineTotal: calcLineTotal(quantity, rate),
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      createdAt: now,
    })
  })

  const nextProducts = syncProductsWithBatches(products, nextBatches)

  setBatches(nextBatches)
  setProducts(nextProducts)
  setPurchases([...purchases, ...newPurchases])

  return { ok: true, invoiceNumber, lines: newPurchases }
}

export function groupPurchasesByInvoice(purchases) {
  const groups = new Map()

  purchases.forEach((purchase) => {
    const key = purchase.invoiceNumber
    if (!groups.has(key)) {
      groups.set(key, {
        invoiceNumber: purchase.invoiceNumber,
        purchaseDate: purchase.purchaseDate,
        supplierName: purchase.supplierName,
        createdAt: purchase.createdAt,
        items: [],
        total: 0,
      })
    }
    const group = groups.get(key)
    group.items.push(purchase)
    group.total += toNumber(purchase.lineTotal)
    if (purchase.purchaseDate < group.purchaseDate) group.purchaseDate = purchase.purchaseDate
  })

  return [...groups.values()].sort((a, b) => {
    const dateCompare = String(b.purchaseDate).localeCompare(String(a.purchaseDate))
    if (dateCompare !== 0) return dateCompare
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
}
