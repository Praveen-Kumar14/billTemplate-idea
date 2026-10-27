import { isValidDateKey } from '../utils/dateUtils'
import { toNumber } from '../utils/calculations'
import { nextId } from '../utils/id'
import { UNIT_OPTIONS } from '../utils/constants'
import {
  getBatches,
  getProducts,
  setBatches,
  setProducts,
} from './storageService'

const VALID_UNITS = UNIT_OPTIONS.map((option) => option.value)

export function normalizeSku(value) {
  return String(value || '').trim().toUpperCase()
}

export function validateProductInput(input, products, editingId = null) {
  const errors = {}
  const name = String(input.productName || '').trim()
  const sku = normalizeSku(input.sku)
  const expiryDate = input.expiryDate || ''
  const manufacturingDate = input.manufacturingDate || ''
  const purchasePrice = String(input.purchasePrice ?? '').trim()
  const salePrice = String(input.salePrice ?? '').trim()
  const currentStock = String(input.currentStock ?? '').trim()

  if (!name) errors.productName = 'Product name is required.'
  if (!sku) errors.sku = 'SKU / product code is required.'
  if (!String(input.category || '').trim()) errors.category = 'Category is required.'
  if (!VALID_UNITS.includes(input.unit)) errors.unit = 'Select a valid unit type.'
  if (toNumber(input.packageWeight) <= 0) {
    errors.packageWeight = 'Package weight / volume must be greater than zero.'
  }
  if (!purchasePrice) {
    errors.purchasePrice = 'Purchase price is required.'
  } else if (toNumber(input.purchasePrice) < 0) {
    errors.purchasePrice = 'Purchase price cannot be negative.'
  }
  if (!salePrice) {
    errors.salePrice = 'Sale price is required.'
  } else if (toNumber(input.salePrice) < 0) {
    errors.salePrice = 'Sale price cannot be negative.'
  }
  if (!currentStock) {
    errors.currentStock = 'Current stock quantity is required.'
  } else if (toNumber(input.currentStock) < 0) {
    errors.currentStock = 'Current stock cannot be negative.'
  }
  if (toNumber(input.openingStock) < 0) {
    errors.openingStock = 'Opening stock cannot be negative.'
  }
  if (!expiryDate) {
    errors.expiryDate = 'Expiry date is required.'
  } else if (!isValidDateKey(expiryDate)) {
    errors.expiryDate = 'Enter a valid expiry date.'
  }
  if (manufacturingDate && !isValidDateKey(manufacturingDate)) {
    errors.manufacturingDate = 'Enter a valid manufacturing date.'
  }
  if (manufacturingDate && expiryDate && manufacturingDate >= expiryDate) {
    errors.expiryDate = 'Expiry date must be later than the manufacturing date.'
  }

  const duplicate = products.find(
    (product) => normalizeSku(product.sku) === sku && product.id !== editingId,
  )
  if (!errors.sku && duplicate) {
    errors.sku = `SKU already used by ${duplicate.productName}.`
  }

  return errors
}

function syncProductFromBatches(product, batches) {
  const productBatches = batches.filter((batch) => batch.productId === product.id)
  if (!productBatches.length) return product

  const currentStock = productBatches.reduce(
    (total, batch) => total + toNumber(batch.quantity),
    0,
  )
  const earliestExpiry = productBatches
    .filter((batch) => toNumber(batch.quantity) > 0)
    .map((batch) => batch.expiryDate)
    .filter(Boolean)
    .sort()[0]

  return {
    ...product,
    currentStock,
    expiryDate: earliestExpiry || product.expiryDate,
  }
}

function adjustBatchesForStock(product, batches, desiredStock, input) {
  const productBatches = batches.filter((batch) => batch.productId === product.id)
  const currentTotal = productBatches.reduce(
    (total, batch) => total + toNumber(batch.quantity),
    0,
  )
  let delta = toNumber(desiredStock) - currentTotal
  const nextBatches = [...batches]

  if (delta > 0) {
    const nextBatch = {
      id: nextId('BATCH', nextBatches),
      productId: product.id,
      batchNumber: 'ADJUSTMENT',
      quantity: delta,
      manufacturingDate: input.manufacturingDate || product.manufacturingDate || null,
      expiryDate: input.expiryDate || product.expiryDate,
      source: 'adjustment',
      purchaseInvoice: null,
      createdAt: new Date().toISOString(),
    }
    nextBatches.push(nextBatch)
    delta = 0
  } else if (delta < 0) {
    let remaining = Math.abs(delta)
    const ordered = nextBatches
      .filter((batch) => batch.productId === product.id)
      .sort((a, b) => {
        const aAdjustable = a.source === 'opening' || a.source === 'adjustment' ? 0 : 1
        const bAdjustable = b.source === 'opening' || b.source === 'adjustment' ? 0 : 1
        if (aAdjustable !== bAdjustable) return aAdjustable - bAdjustable
        return String(b.expiryDate || '').localeCompare(String(a.expiryDate || ''))
      })

    ordered.forEach((batch) => {
      if (remaining <= 0) return
      const index = nextBatches.findIndex((item) => item.id === batch.id)
      const take = Math.min(toNumber(batch.quantity), remaining)
      nextBatches[index] = {
        ...batch,
        quantity: toNumber(batch.quantity) - take,
      }
      remaining -= take
    })
  }

  const adjustable = nextBatches.find(
    (batch) =>
      batch.productId === product.id &&
      (batch.source === 'opening' || batch.source === 'adjustment'),
  )
  if (adjustable) {
    const index = nextBatches.findIndex((batch) => batch.id === adjustable.id)
    nextBatches[index] = {
      ...adjustable,
      manufacturingDate: input.manufacturingDate || adjustable.manufacturingDate || null,
      expiryDate: input.expiryDate || adjustable.expiryDate,
    }
  } else if (toNumber(desiredStock) === 0 && input.expiryDate) {
    nextBatches.push({
      id: nextId('BATCH', nextBatches),
      productId: product.id,
      batchNumber: 'OPENING',
      quantity: 0,
      manufacturingDate: input.manufacturingDate || null,
      expiryDate: input.expiryDate,
      source: 'opening',
      purchaseInvoice: null,
      createdAt: new Date().toISOString(),
    })
  }

  return nextBatches
}

export function createProduct(input) {
  const products = getProducts()
  const batches = getBatches()
  const errors = validateProductInput(input, products)
  if (Object.keys(errors).length) {
    return { ok: false, errors }
  }

  const now = new Date().toISOString()
  const openingStock =
    String(input.openingStock ?? '').trim() === ''
      ? toNumber(input.currentStock)
      : toNumber(input.openingStock)
  const product = {
    id: nextId('PROD', products),
    productName: String(input.productName).trim(),
    sku: normalizeSku(input.sku),
    category: String(input.category).trim(),
    brand: String(input.brand || '').trim(),
    unit: input.unit,
    packageWeight: toNumber(input.packageWeight),
    purchasePrice: toNumber(input.purchasePrice),
    salePrice: toNumber(input.salePrice),
    openingStock,
    currentStock: toNumber(input.currentStock),
    manufacturingDate: input.manufacturingDate || null,
    expiryDate: input.expiryDate,
    supplierName: String(input.supplierName || '').trim(),
    description: String(input.description || '').trim(),
    createdAt: now,
    updatedAt: now,
  }

  const openingBatch = {
    id: nextId('BATCH', batches),
    productId: product.id,
    batchNumber: 'OPENING',
    quantity: toNumber(input.currentStock),
    manufacturingDate: product.manufacturingDate,
    expiryDate: product.expiryDate,
    source: 'opening',
    purchaseInvoice: null,
    createdAt: now,
  }

  setBatches([...batches, openingBatch])
  setProducts([...products, product])
  return { ok: true, product }
}

export function updateProduct(id, input) {
  const products = getProducts()
  const batches = getBatches()
  const existing = products.find((product) => product.id === id)
  if (!existing) return { ok: false, errors: { form: 'Product not found.' } }

  const errors = validateProductInput(input, products, id)
  if (Object.keys(errors).length) {
    return { ok: false, errors }
  }

  let nextBatches = adjustBatchesForStock(existing, batches, input.currentStock, input)
  nextBatches = nextBatches.map((batch) => {
    if (batch.productId !== id) return batch
    return { ...batch }
  })

  const updatedProduct = {
    ...existing,
    productName: String(input.productName).trim(),
    sku: normalizeSku(input.sku),
    category: String(input.category).trim(),
    brand: String(input.brand || '').trim(),
    unit: input.unit,
    packageWeight: toNumber(input.packageWeight),
    purchasePrice: toNumber(input.purchasePrice),
    salePrice: toNumber(input.salePrice),
    openingStock:
      String(input.openingStock ?? '').trim() === ''
        ? toNumber(existing.openingStock)
        : toNumber(input.openingStock),
    manufacturingDate: input.manufacturingDate || null,
    expiryDate: input.expiryDate,
    supplierName: String(input.supplierName || '').trim(),
    description: String(input.description || '').trim(),
    updatedAt: new Date().toISOString(),
  }

  const syncedProduct = syncProductFromBatches(updatedProduct, nextBatches)

  setBatches(nextBatches)
  setProducts(
    products.map((product) => (product.id === id ? syncedProduct : product)),
  )
  return { ok: true, product: syncedProduct }
}

export function deleteProduct(id) {
  const products = getProducts()
  const batches = getBatches()
  setBatches(batches.filter((batch) => batch.productId !== id))
  setProducts(products.filter((product) => product.id !== id))
}

export function getProductById(id) {
  return getProducts().find((product) => product.id === id) || null
}

export function getProductBatches(productId) {
  return getBatches().filter((batch) => batch.productId === productId)
}

export function syncProductsWithBatches(products, batches) {
  return products.map((product) => syncProductFromBatches(product, batches))
}

export function recalculateAllStocks() {
  const products = getProducts()
  const batches = getBatches()
  const next = syncProductsWithBatches(products, batches)
  setProducts(next)
  return next
}
