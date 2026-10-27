import { buildDummyData } from '../data/dummyData'
import { DEFAULT_NOTIFICATION_TIME, STORAGE_EVENT } from '../utils/constants'

export const STORAGE_KEYS = {
  products: 'grocery_products',
  batches: 'grocery_batches',
  purchases: 'grocery_purchases',
  sales: 'grocery_sales',
  settings: 'grocery_settings',
  emailHistory: 'grocery_email_history',
}

const INITIALIZED_KEY = 'grocery_initialized_v1'
const SCHEMA_VERSION_KEY = 'grocery_schema_version'
const SCHEMA_VERSION = 1

export const DEFAULT_SETTINGS = {
  ownerName: '',
  ownerEmail: '',
  emailJsServiceId: '',
  emailJsTemplateId: '',
  emailJsPublicKey: '',
  notificationTime: DEFAULT_NOTIFICATION_TIME,
  notificationsEnabled: true,
  includeExpiredInEmail: false,
  lastScheduledAlertDate: null,
  lastScheduledCheckDate: null,
  lastScheduledResult: null,
  createdAt: null,
  updatedAt: null,
}

function notifyChange(key) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }))
}

export function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    return parsed === null || parsed === undefined ? fallback : parsed
  } catch (error) {
    console.warn(`Could not read ${key} from LocalStorage.`, error)
    return fallback
  }
}

export function writeJson(key, value, { silent = false } = {}) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    if (!silent) notifyChange(key)
  } catch (error) {
    console.error(`Could not save ${key} to LocalStorage.`, error)
    throw new Error('Local storage is full or unavailable. Please free some space and try again.')
  }
}

export function readCollection(key) {
  const value = readJson(key, [])
  return Array.isArray(value) ? value : []
}

export function writeCollection(key, value, options) {
  writeJson(key, Array.isArray(value) ? value : [], options)
}

export function getProducts() {
  return readCollection(STORAGE_KEYS.products)
}

export function setProducts(products) {
  writeCollection(STORAGE_KEYS.products, products)
}

export function getBatches() {
  return readCollection(STORAGE_KEYS.batches)
}

export function setBatches(batches) {
  writeCollection(STORAGE_KEYS.batches, batches)
}

export function getPurchases() {
  return readCollection(STORAGE_KEYS.purchases)
}

export function setPurchases(purchases) {
  writeCollection(STORAGE_KEYS.purchases, purchases)
}

export function getSales() {
  return readCollection(STORAGE_KEYS.sales)
}

export function setSales(sales) {
  writeCollection(STORAGE_KEYS.sales, sales)
}

export function getSettings() {
  const stored = readJson(STORAGE_KEYS.settings, {})
  return {
    ...DEFAULT_SETTINGS,
    ...(stored && typeof stored === 'object' ? stored : {}),
  }
}

export function saveSettings(settings) {
  const current = getSettings()
  const next = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  }
  writeJson(STORAGE_KEYS.settings, next)
  return next
}

export function getEmailHistory() {
  return readCollection(STORAGE_KEYS.emailHistory)
}

export function appendEmailHistory(entry) {
  const history = getEmailHistory()
  const next = [entry, ...history].slice(0, 500)
  writeCollection(STORAGE_KEYS.emailHistory, next)
  return entry
}

function ensureCollection(key) {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, JSON.stringify([]))
    }
  } catch (error) {
    console.warn(`Could not initialise ${key}.`, error)
  }
}

function seedStorage() {
  const data = buildDummyData()
  writeJson(STORAGE_KEYS.products, data.products, { silent: true })
  writeJson(STORAGE_KEYS.batches, data.batches, { silent: true })
  writeJson(STORAGE_KEYS.purchases, data.purchases, { silent: true })
  writeJson(STORAGE_KEYS.sales, data.sales, { silent: true })
  writeJson(STORAGE_KEYS.settings, data.settings, { silent: true })
  writeJson(STORAGE_KEYS.emailHistory, data.emailHistory, { silent: true })
}

export function initializeStorage() {
  if (typeof window === 'undefined') return

  const initialized = window.localStorage.getItem(INITIALIZED_KEY) === '1'
  const existingKeys = Object.values(STORAGE_KEYS).filter(
    (key) => window.localStorage.getItem(key) !== null,
  )

  if (!initialized && existingKeys.length === 0) {
    seedStorage()
  } else {
    ensureCollection(STORAGE_KEYS.products)
    ensureCollection(STORAGE_KEYS.batches)
    ensureCollection(STORAGE_KEYS.purchases)
    ensureCollection(STORAGE_KEYS.sales)
    ensureCollection(STORAGE_KEYS.emailHistory)
    if (window.localStorage.getItem(STORAGE_KEYS.settings) === null) {
      window.localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ ...DEFAULT_SETTINGS, createdAt: new Date().toISOString() }),
      )
    }
  }

  window.localStorage.setItem(INITIALIZED_KEY, '1')
  window.localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION))
}

export function resetDemoData() {
  if (typeof window === 'undefined') return
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key))
  window.localStorage.removeItem(INITIALIZED_KEY)
  seedStorage()
  window.localStorage.setItem(INITIALIZED_KEY, '1')
  window.localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION))
  notifyChange('all')
}
