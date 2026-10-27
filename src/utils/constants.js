export const UNIT_OPTIONS = [
  { value: 'gram', label: 'Gram (g)', short: 'g' },
  { value: 'kilogram', label: 'Kilogram (kg)', short: 'kg' },
  { value: 'millilitre', label: 'Millilitre (ml)', short: 'ml' },
  { value: 'litre', label: 'Litre (L)', short: 'L' },
  { value: 'piece', label: 'Piece', short: 'pc' },
  { value: 'packet', label: 'Packet', short: 'pkt' },
  { value: 'box', label: 'Box', short: 'box' },
]

export const CATEGORY_OPTIONS = [
  'Rice & Grains',
  'Wheat & Flour',
  'Dairy',
  'Biscuits',
  'Cooking Oil',
  'Instant Food',
  'Spices',
  'Beverages',
  'Breakfast Cereal',
  'Snacks',
  'Staples',
  'Personal Care',
  'Household',
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
]

export const STOCK_FILTERS = [
  { value: 'all', label: 'All stock' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
]

export const EXPIRY_FILTERS = [
  { value: 'all', label: 'All expiry' },
  { value: 'safe', label: 'Safe' },
  { value: 'soon', label: 'Expiring soon' },
  { value: 'today', label: 'Expiring today' },
  { value: 'expired', label: 'Expired' },
]

export const REPORT_GROUPINGS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

export const DEFAULT_NOTIFICATION_TIME = '10:30'

export const STORAGE_EVENT = 'grocery:data-changed'
export const EMAIL_RESULT_EVENT = 'grocery:email-result'
