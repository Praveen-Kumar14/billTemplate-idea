import { addDaysToKey, toDateKey, todayKey } from '../utils/dateUtils'
import { round2 } from '../utils/calculations'

function isoAtKolkata(dateKey, hour, minute = 0) {
  if (!dateKey || typeof dateKey !== 'string') return new Date().toISOString()
  const [year, month, day] = dateKey.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, day, hour, minute) - 5.5 * 60 * 60 * 1000
  return new Date(utc).toISOString()
}

function compactDate(dateKey) {
  if (!dateKey || typeof dateKey !== 'string') return ''
  return dateKey.replaceAll('-', '')
}

export function buildDummyData(referenceDate = todayKey()) {
  const now = new Date().toISOString()
  const day = (offset) => addDaysToKey(referenceDate, offset)

  const definitions = [
    {
      key: 'rice',
      productName: 'India Gate Basmati Rice',
      sku: 'RICE-BAS-5K',
      category: 'Rice & Grains',
      brand: 'India Gate',
      unit: 'kilogram',
      packageWeight: 5,
      purchasePrice: 480,
      salePrice: 560,
      openingStock: 30,
      manufacturingDate: day(-40),
      supplierName: 'Sri Venkateswara Distributors',
      description: 'Premium aged basmati rice, 5 kg pack.',
      batches: [
        { batchNumber: 'RB-2401', quantity: 10, expiryDate: day(90), manufacturingDate: day(-40) },
        { batchNumber: 'RB-2402', quantity: 8, expiryDate: day(150), manufacturingDate: day(-10) },
      ],
    },
    {
      key: 'atta',
      productName: 'Aashirvaad Whole Wheat Atta',
      sku: 'ATTA-WW-5K',
      category: 'Wheat & Flour',
      brand: 'Aashirvaad',
      unit: 'kilogram',
      packageWeight: 5,
      purchasePrice: 240,
      salePrice: 285,
      openingStock: 32,
      manufacturingDate: day(-35),
      supplierName: 'Sri Venkateswara Distributors',
      description: 'Chakki fresh atta for soft rotis.',
      batches: [
        { batchNumber: 'AW-5510', quantity: 12, expiryDate: day(60), manufacturingDate: day(-35) },
        { batchNumber: 'AW-5511', quantity: 10, expiryDate: day(75), manufacturingDate: day(-20) },
      ],
    },
    {
      key: 'milk',
      productName: 'Amul Milk Powder',
      sku: 'MILK-AMU-500',
      category: 'Dairy',
      brand: 'Amul',
      unit: 'gram',
      packageWeight: 500,
      purchasePrice: 180,
      salePrice: 220,
      openingStock: 18,
      manufacturingDate: day(-120),
      supplierName: 'Amul Dairy Depot',
      description: 'Instant whole milk powder, 500 g pouch.',
      batches: [
        { batchNumber: 'MP-1026', quantity: 12, expiryDate: day(4), manufacturingDate: day(-120) },
      ],
    },
    {
      key: 'parle',
      productName: 'Parle-G Biscuits',
      sku: 'BISC-PAR-800',
      category: 'Biscuits',
      brand: 'Parle',
      unit: 'gram',
      packageWeight: 800,
      purchasePrice: 65,
      salePrice: 85,
      openingStock: 40,
      manufacturingDate: day(-100),
      supplierName: 'Metro Wholesale',
      description: 'Family pack glucose biscuits.',
      batches: [
        { batchNumber: 'PG-8842', quantity: 30, expiryDate: day(2), manufacturingDate: day(-100) },
      ],
    },
    {
      key: 'oil',
      productName: 'Fortune Sunflower Oil',
      sku: 'OIL-FOR-1L',
      category: 'Cooking Oil',
      brand: 'Fortune',
      unit: 'litre',
      packageWeight: 1,
      purchasePrice: 135,
      salePrice: 165,
      openingStock: 24,
      manufacturingDate: day(-30),
      supplierName: 'Metro Wholesale',
      description: 'Refined sunflower oil, 1 litre bottle.',
      batches: [
        { batchNumber: 'FO-5521', quantity: 16, expiryDate: day(45), manufacturingDate: day(-30) },
      ],
    },
    {
      key: 'maggi',
      productName: 'Maggi 2-Minute Noodles',
      sku: 'INST-MAG-12P',
      category: 'Instant Food',
      brand: 'Nestle',
      unit: 'gram',
      packageWeight: 840,
      purchasePrice: 150,
      salePrice: 185,
      openingStock: 35,
      manufacturingDate: day(-25),
      supplierName: 'Metro Wholesale',
      description: 'Masala noodles, pack of 12.',
      batches: [
        { batchNumber: 'MG-1190', quantity: 25, expiryDate: day(20), manufacturingDate: day(-25) },
      ],
    },
    {
      key: 'turmeric',
      productName: 'Everest Turmeric Powder',
      sku: 'SPIC-EVE-200',
      category: 'Spices',
      brand: 'Everest',
      unit: 'gram',
      packageWeight: 200,
      purchasePrice: 48,
      salePrice: 65,
      openingStock: 20,
      manufacturingDate: day(-160),
      supplierName: 'Sri Venkateswara Distributors',
      description: 'Pure haldi powder, 200 g pack.',
      batches: [
        { batchNumber: 'EV-3320', quantity: 14, expiryDate: day(5), manufacturingDate: day(-160) },
      ],
    },
    {
      key: 'juice',
      productName: 'Real Fruit Juice',
      sku: 'BEV-REA-1L',
      category: 'Beverages',
      brand: 'Dabur',
      unit: 'litre',
      packageWeight: 1,
      purchasePrice: 95,
      salePrice: 120,
      openingStock: 15,
      manufacturingDate: day(-200),
      supplierName: 'Metro Wholesale',
      description: 'Mixed fruit juice, 1 litre tetra pack.',
      batches: [
        { batchNumber: 'RJ-9081', quantity: 9, expiryDate: referenceDate, manufacturingDate: day(-200) },
      ],
    },
    {
      key: 'cereal',
      productName: "Kellogg's Corn Flakes",
      sku: 'CERE-KEL-475',
      category: 'Breakfast Cereal',
      brand: "Kellogg's",
      unit: 'gram',
      packageWeight: 475,
      purchasePrice: 210,
      salePrice: 260,
      openingStock: 15,
      manufacturingDate: day(-50),
      supplierName: 'Metro Wholesale',
      description: 'Original corn flakes, 475 g box.',
      batches: [
        { batchNumber: 'KF-7712', quantity: 11, expiryDate: day(35), manufacturingDate: day(-50) },
      ],
    },
    {
      key: 'bhujia',
      productName: "Haldiram's Aloo Bhujia",
      sku: 'SNC-HAL-400',
      category: 'Snacks',
      brand: "Haldiram's",
      unit: 'gram',
      packageWeight: 400,
      purchasePrice: 72,
      salePrice: 95,
      openingStock: 12,
      manufacturingDate: day(-120),
      supplierName: 'Metro Wholesale',
      description: 'Crispy potato bhujia namkeen.',
      batches: [
        { batchNumber: 'HB-2201', quantity: 7, expiryDate: day(-3), manufacturingDate: day(-120) },
      ],
    },
    {
      key: 'salt',
      productName: 'Tata Salt',
      sku: 'STPL-TAT-1K',
      category: 'Staples',
      brand: 'Tata',
      unit: 'kilogram',
      packageWeight: 1,
      purchasePrice: 20,
      salePrice: 28,
      openingStock: 50,
      manufacturingDate: day(-10),
      supplierName: 'Metro Wholesale',
      description: 'Iodised salt, 1 kg pack.',
      batches: [
        { batchNumber: 'TS-6610', quantity: 40, expiryDate: day(180), manufacturingDate: day(-10) },
      ],
    },
    {
      key: 'nescafe',
      productName: 'Nescafe Classic Coffee',
      sku: 'BEV-NES-100',
      category: 'Beverages',
      brand: 'Nescafe',
      unit: 'gram',
      packageWeight: 100,
      purchasePrice: 280,
      salePrice: 340,
      openingStock: 18,
      manufacturingDate: day(-60),
      supplierName: 'Metro Wholesale',
      description: 'Instant coffee powder, 100 g jar.',
      batches: [
        { batchNumber: 'NC-4419', quantity: 13, expiryDate: day(70), manufacturingDate: day(-60) },
      ],
    },
    {
      key: 'handwash',
      productName: 'Dettol Liquid Handwash',
      sku: 'PC-DET-750',
      category: 'Personal Care',
      brand: 'Dettol',
      unit: 'millilitre',
      packageWeight: 750,
      purchasePrice: 145,
      salePrice: 180,
      openingStock: 14,
      manufacturingDate: day(-90),
      supplierName: 'Metro Wholesale',
      description: 'Original liquid handwash refill.',
      batches: [
        { batchNumber: 'DH-8830', quantity: 10, expiryDate: day(120), manufacturingDate: day(-90) },
      ],
    },
    {
      key: 'goodday',
      productName: 'Britannia Good Day Cookies',
      sku: 'BISC-BRI-600',
      category: 'Biscuits',
      brand: 'Britannia',
      unit: 'gram',
      packageWeight: 600,
      purchasePrice: 110,
      salePrice: 140,
      openingStock: 25,
      manufacturingDate: day(-110),
      supplierName: 'Metro Wholesale',
      description: 'Butter cookies family pack.',
      batches: [
        { batchNumber: 'BG-5570', quantity: 20, expiryDate: day(3), manufacturingDate: day(-110) },
      ],
    },
  ]

  const products = []
  const batches = []
  let batchCounter = 0

  definitions.forEach((definition, index) => {
    const productId = `PROD-${String(index + 1).padStart(3, '0')}`
    const productBatches = definition.batches.map((batch) => {
      batchCounter += 1
      return {
        id: `BATCH-${String(batchCounter).padStart(3, '0')}`,
        productId,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        manufacturingDate: batch.manufacturingDate || definition.manufacturingDate || null,
        expiryDate: batch.expiryDate,
        source: 'opening',
        purchaseInvoice: null,
        createdAt: now,
      }
    })

    const currentStock = productBatches.reduce((total, batch) => total + batch.quantity, 0)
    const earliestExpiry = productBatches
      .map((batch) => batch.expiryDate)
      .filter(Boolean)
      .sort()[0]

    products.push({
      id: productId,
      productName: definition.productName,
      sku: definition.sku,
      category: definition.category,
      brand: definition.brand,
      unit: definition.unit,
      packageWeight: definition.packageWeight,
      purchasePrice: definition.purchasePrice,
      salePrice: definition.salePrice,
      openingStock: definition.openingStock,
      currentStock,
      manufacturingDate: definition.manufacturingDate || null,
      expiryDate: earliestExpiry || null,
      supplierName: definition.supplierName,
      description: definition.description,
      createdAt: now,
      updatedAt: now,
    })
    batches.push(...productBatches)
  })

  const productByKey = definitions.reduce((map, definition, index) => {
    map[definition.key] = products[index]
    return map
  }, {})

  const purchases = []
  let purchaseCounter = 0

  const addPurchase = (invoiceNumber, purchaseDate, supplierName, lines, createdAt) => {
    lines.forEach((line) => {
      purchaseCounter += 1
      const product = productByKey[line.key]
      const batch = definitions.find((item) => item.key === line.key)?.batches[line.batchIndex || 0]
      purchases.push({
        id: `PUR-${String(purchaseCounter).padStart(3, '0')}`,
        invoiceNumber,
        purchaseDate,
        supplierName,
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        unit: product.unit,
        packageWeight: product.packageWeight,
        quantity: line.quantity,
        rate: line.rate,
        lineTotal: round2(line.quantity * line.rate),
        batchNumber: batch?.batchNumber || '',
        manufacturingDate: batch?.manufacturingDate || product.manufacturingDate || null,
        expiryDate: batch?.expiryDate || product.expiryDate,
        createdAt,
      })
    })
  }

  addPurchase(
    `PINV-${compactDate(day(-6))}-001`,
    day(-6),
    'Sri Venkateswara Distributors',
    [
      { key: 'rice', quantity: 10, rate: 480, batchIndex: 0 },
      { key: 'atta', quantity: 10, rate: 240, batchIndex: 1 },
    ],
    isoAtKolkata(day(-6), 11, 15),
  )

  addPurchase(
    `PINV-${compactDate(day(-3))}-002`,
    day(-3),
    'Amul Dairy Depot',
    [
      { key: 'milk', quantity: 12, rate: 180 },
      { key: 'goodday', quantity: 12, rate: 110 },
    ],
    isoAtKolkata(day(-3), 10, 40),
  )

  addPurchase(
    `PINV-${compactDate(referenceDate)}-003`,
    referenceDate,
    'Metro Wholesale',
    [
      { key: 'oil', quantity: 8, rate: 135 },
      { key: 'maggi', quantity: 10, rate: 150 },
      { key: 'salt', quantity: 20, rate: 20 },
    ],
    isoAtKolkata(referenceDate, 9, 25),
  )

  const makeSaleItem = (key, quantity) => {
    const product = productByKey[key]
    return {
      productId: product.id,
      productName: product.productName,
      sku: product.sku,
      unit: product.unit,
      packageWeight: product.packageWeight,
      quantity,
      price: product.salePrice,
      lineTotal: round2(quantity * product.salePrice),
      batchesUsed: [],
    }
  }

  const addSale = (offset, invoiceSuffix, time, customer, mobile, paymentMethod, discount, lines) => {
    const saleDateKey = typeof offset === 'number' ? day(offset) : (offset || referenceDate)
    const items = lines.map(([key, quantity]) => makeSaleItem(key, quantity))
    const subtotal = round2(items.reduce((total, item) => total + item.lineTotal, 0))
    const saleDate = isoAtKolkata(saleDateKey, time[0], time[1])
    return {
      id: `SALE-${String(invoiceSuffix).padStart(3, '0')}`,
      invoiceNumber: `INV-${compactDate(saleDateKey)}-${String(invoiceSuffix).padStart(3, '0')}`,
      saleDate,
      dateKey: saleDateKey,
      customerName: customer,
      mobile,
      items,
      subtotal,
      discount,
      grandTotal: round2(subtotal - discount),
      paymentMethod,
      createdAt: saleDate,
    }
  }

  const sales = [
    addSale(0, 1, [12, 10], 'Ramesh Kumar', '9876543210', 'upi', 20, [
      ['milk', 2],
      ['parle', 4],
      ['juice', 1],
    ]),
    addSale(-1, 1, [18, 35], 'Walk-in Customer', '', 'cash', 0, [
      ['rice', 1],
      ['oil', 1],
      ['maggi', 2],
    ]),
    addSale(-3, 1, [17, 5], 'Sita Devi', '9123456780', 'card', 40, [
      ['atta', 2],
      ['goodday', 2],
      ['nescafe', 1],
    ]),
    addSale(-5, 1, [11, 20], 'Walk-in Customer', '', 'cash', 21, [
      ['salt', 2],
      ['parle', 1],
      ['juice', 1],
      ['cereal', 1],
    ]),
  ]

  const settings = {
    ownerName: 'Sri Lakshmi Grocery',
    ownerEmail: '',
    emailJsServiceId: '',
    emailJsTemplateId: '',
    emailJsPublicKey: '',
    notificationTime: '10:30',
    notificationsEnabled: true,
    includeExpiredInEmail: false,
    lastScheduledAlertDate: null,
    lastScheduledCheckDate: null,
    lastScheduledResult: null,
    createdAt: now,
    updatedAt: now,
  }

  return { products, batches, purchases, sales, settings, emailHistory: [] }
}

export const dummyDataMeta = {
  generatedFor: toDateKey(new Date()),
}
