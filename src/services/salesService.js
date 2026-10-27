import { daysRemaining, isValidDateKey, todayKey } from '../utils/dateUtils'
import { calcInvoiceTotals, calcLineTotal, toNumber } from '../utils/calculations'
import { nextId } from '../utils/id'
import { PAYMENT_METHODS } from '../utils/constants'
import {
  getBatches,
  getProducts,
  getSales,
  setBatches,
  setProducts,
  setSales,
} from './storageService'
import { syncProductsWithBatches } from './productService'

const VALID_PAYMENT_METHODS = PAYMENT_METHODS.map((method) => method.value)

function compactDate(dateKey) {
  return String(dateKey || '').replaceAll('-', '')
}

export function generateSaleInvoiceNumber(dateKey = todayKey()) {
  const sales = getSales()
  const prefix = `INV-${compactDate(dateKey)}-`
  const max = sales.reduce((current, invoice) => {
    if (!String(invoice.invoiceNumber || '').startsWith(prefix)) return current
    const match = String(invoice.invoiceNumber).match(/-(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

export function getEligibleBatches(productId, batches, referenceDate = todayKey()) {
  return (batches || [])
    .filter(
      (batch) =>
        batch.productId === productId &&
        toNumber(batch.quantity) > 0 &&
        (!batch.expiryDate || daysRemaining(batch.expiryDate, referenceDate) >= 0),
    )
    .sort((a, b) => {
      const expiryCompare = String(a.expiryDate || '9999-12-31').localeCompare(
        String(b.expiryDate || '9999-12-31'),
      )
      if (expiryCompare !== 0) return expiryCompare
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    })
}

export function getAvailableStock(productId, currentStock, batches, referenceDate = todayKey()) {
  const productBatches = (batches || []).filter((batch) => batch.productId === productId)
  if (!productBatches.length) return toNumber(currentStock)
  return getEligibleBatches(productId, batches, referenceDate).reduce(
    (total, batch) => total + toNumber(batch.quantity),
    0,
  )
}

export function getSellableStockMap(products, batches, referenceDate = todayKey()) {
  return (products || []).reduce((map, product) => {
    map[product.id] = getAvailableStock(
      product.id,
      product.currentStock,
      batches,
      referenceDate,
    )
    return map
  }, {})
}

export function validateSale(input, products = getProducts(), batches = getBatches()) {
  const errors = {}
  const lineErrors = []
  const items = Array.isArray(input.items) ? input.items : []
  const referenceDate = todayKey()
  const discount = toNumber(input.discount)

  if (!items.length) errors.items = 'Add at least one product to the invoice.'
  if (discount < 0) errors.discount = 'Discount cannot be negative.'
  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) {
    errors.paymentMethod = 'Select a valid payment method.'
  }
  const mobile = String(input.mobile || '').replace(/\D/g, '')
  if (input.mobile && (mobile.length < 10 || mobile.length > 13)) {
    errors.mobile = 'Enter a valid mobile number.'
  }

  const requestedByProduct = {}

  items.forEach((item, index) => {
    const lineError = {}
    const product = products.find((entry) => entry.id === item.productId)
    const quantity = toNumber(item.quantity)

    if (!product) {
      lineError.productId = 'Select a product.'
    }
    if (quantity <= 0) lineError.quantity = 'Quantity must be greater than zero.'

    if (product && quantity > 0) {
      requestedByProduct[product.id] = (requestedByProduct[product.id] || 0) + quantity
      const available = getAvailableStock(
        product.id,
        product.currentStock,
        batches,
        referenceDate,
      )
      if (requestedByProduct[product.id] > available) {
        lineError.quantity = `Only ${available} sellable unit${available === 1 ? '' : 's'} available.`
      }
    }

    lineErrors[index] = lineError
  })

  const subtotal = items.reduce(
    (total, item) => total + toNumber(item.quantity) * toNumber(
      products.find((product) => product.id === item.productId)?.salePrice,
    ),
    0,
  )
  if (discount > subtotal) {
    errors.discount = 'Discount cannot be greater than the subtotal.'
  }

  return { errors, lineErrors }
}

export function createSale(input) {
  const products = getProducts()
  const batches = getBatches()
  const sales = getSales()
  const { errors, lineErrors } = validateSale(input, products, batches)

  const hasLineErrors = lineErrors.some((line) => Object.keys(line).length > 0)
  if (Object.keys(errors).length || hasLineErrors) {
    return { ok: false, errors, lineErrors }
  }

  if (!isValidDateKey(input.dateKey || todayKey())) {
    return { ok: false, errors: { form: 'Invalid sale date.' }, lineErrors }
  }

  const now = new Date()
  const dateKey = todayKey(now)
  const invoiceNumber =
    String(input.invoiceNumber || '').trim() || generateSaleInvoiceNumber(dateKey)

  if (
    sales.some(
      (invoice) =>
        String(invoice.invoiceNumber || '').toLowerCase() === invoiceNumber.toLowerCase(),
    )
  ) {
    return {
      ok: false,
      errors: { invoiceNumber: 'This invoice number already exists.' },
      lineErrors,
    }
  }

  let nextBatches = batches.map((batch) => ({ ...batch }))
  const saleItems = []
  const stockFallbacks = {}

  input.items.forEach((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    const quantity = toNumber(item.quantity)
    const productBatchRows = nextBatches.filter((batch) => batch.productId === product.id)
    const batchesUsed = []
    let remaining = quantity

    if (productBatchRows.length) {
      const eligible = getEligibleBatches(product.id, nextBatches, dateKey)
      eligible.forEach((batch) => {
        if (remaining <= 0) return
        const index = nextBatches.findIndex((entry) => entry.id === batch.id)
        const take = Math.min(toNumber(batch.quantity), remaining)
        nextBatches[index] = {
          ...batch,
          quantity: toNumber(batch.quantity) - take,
        }
        batchesUsed.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: take,
          expiryDate: batch.expiryDate,
        })
        remaining -= take
      })
    } else {
      if (!stockFallbacks[product.id]) {
        stockFallbacks[product.id] = toNumber(product.currentStock)
      }
      stockFallbacks[product.id] -= quantity
      remaining = 0
    }

    saleItems.push({
      productId: product.id,
      productName: product.productName,
      sku: product.sku,
      unit: product.unit,
      packageWeight: product.packageWeight,
      quantity,
      price: toNumber(product.salePrice),
      lineTotal: calcLineTotal(quantity, product.salePrice),
      batchesUsed,
    })
  })

  const totals = calcInvoiceTotals(
    saleItems.map((item) => ({ quantity: item.quantity, rate: item.price })),
    input.discount,
  )

  let nextProducts = products.map((product) => {
    if (!(product.id in stockFallbacks)) return product
    return { ...product, currentStock: Math.max(0, stockFallbacks[product.id]) }
  })
  nextProducts = syncProductsWithBatches(nextProducts, nextBatches).map((product) => {
    if (product.id in stockFallbacks) {
      return { ...product, currentStock: Math.max(0, stockFallbacks[product.id]) }
    }
    return product
  })

  const invoice = {
    id: nextId('SALE', sales),
    invoiceNumber,
    saleDate: now.toISOString(),
    dateKey,
    customerName: String(input.customerName || '').trim(),
    mobile: String(input.mobile || '').trim(),
    items: saleItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    grandTotal: totals.grandTotal,
    paymentMethod: input.paymentMethod,
    createdAt: now.toISOString(),
  }

  setBatches(nextBatches)
  setProducts(nextProducts)
  setSales([invoice, ...sales])

  return { ok: true, invoice }
}

export function getSaleInvoice(id) {
  return getSales().find((invoice) => invoice.id === id) || null
}

export function flattenSaleLines(sales) {
  return (sales || []).flatMap((invoice) =>
    (invoice.items || []).map((item, index) => ({
      rowId: `${invoice.id}-${index}`,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      saleDate: invoice.saleDate,
      dateKey: invoice.dateKey,
      customerName: invoice.customerName,
      mobile: invoice.mobile,
      paymentMethod: invoice.paymentMethod,
      discount: invoice.discount,
      grandTotal: invoice.grandTotal,
      subtotal: invoice.subtotal,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unit: item.unit,
      packageWeight: item.packageWeight,
      quantity: item.quantity,
      price: item.price,
      lineTotal: item.lineTotal,
    })),
  )
}
