import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  PackageSearch,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  ShoppingCart,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { createSale, generateSaleInvoiceNumber, getSellableStockMap } from '../services/salesService'
import { getExpiryMeta, formatDateTime } from '../utils/dateUtils'
import {
  calcInvoiceTotals,
  calcLineTotal,
  formatCurrency,
  formatNumber,
  formatWeightValue,
} from '../utils/calculations'
import { PAYMENT_METHODS } from '../utils/constants'
import { makeId } from '../utils/id'
import { escapeHtml, printDocument } from '../utils/print'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ExpiryBadge from '../components/ui/ExpiryBadge'
import { Field, Input } from '../components/ui/Field'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import SearchInput from '../components/ui/SearchInput'

const PAYMENT_ICONS = {
  cash: Banknote,
  upi: Smartphone,
  card: CreditCard,
}

function paymentLabel(value) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label || value
}

function buildReceiptHtml(invoice, shopName) {
  const rows = invoice.items
    .map(
      (item) => `<tr>
  <td>${escapeHtml(item.productName)}<br /><span style="color:#64748b;font-size:10px;">${escapeHtml(item.sku)} · ${escapeHtml(formatWeightValue(item.packageWeight, item.unit))}</span></td>
  <td class="num">${formatNumber(item.quantity)}</td>
  <td class="num">${escapeHtml(formatCurrency(item.price))}</td>
  <td class="num">${escapeHtml(formatCurrency(item.lineTotal))}</td>
</tr>`,
    )
    .join('')

  return `<div class="doc-header">
  <div>
    <h1>${escapeHtml(shopName || 'Grocery Store')}</h1>
    <p>Customer receipt</p>
    <p>${escapeHtml(invoice.invoiceNumber)}</p>
  </div>
  <div class="meta">
    <strong>${escapeHtml(formatDateTime(invoice.saleDate))}</strong>
    <p>Payment: ${escapeHtml(paymentLabel(invoice.paymentMethod))}</p>
    <p>${escapeHtml(invoice.customerName || 'Walk-in customer')}${invoice.mobile ? ` · ${escapeHtml(invoice.mobile)}` : ''}</p>
  </div>
</div>
<table>
  <thead>
    <tr><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Subtotal</span><strong>${escapeHtml(formatCurrency(invoice.subtotal))}</strong></div>
  <div><span>Discount</span><strong>− ${escapeHtml(formatCurrency(invoice.discount))}</strong></div>
  <div class="grand"><span>Grand total</span><span>${escapeHtml(formatCurrency(invoice.grandTotal))}</span></div>
</div>
<p class="note">Thank you for shopping with us. Goods sold are not returnable without a receipt.</p>`
}

export default function SalesBilling() {
  const { products, batches, settings, today } = useData()
  const toast = useToast()

  const [invoiceNumber, setInvoiceNumber] = useState(() => generateSaleInvoiceNumber(today))
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [customerName, setCustomerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [errors, setErrors] = useState({})
  const [lineErrors, setLineErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )
  const stockMap = useMemo(
    () => getSellableStockMap(products, batches, today),
    [products, batches, today],
  )

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products
      .filter((product) => {
        if (!query) return true
        return [product.productName, product.sku, product.brand]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      })
      .sort((a, b) => {
        const aStock = stockMap[a.id] || 0
        const bStock = stockMap[b.id] || 0
        if ((aStock > 0) !== (bStock > 0)) return aStock > 0 ? -1 : 1
        return String(a.productName).localeCompare(String(b.productName))
      })
  }, [products, search, stockMap])

  const cartDetailed = cart.map((line) => {
    const product = productMap.get(line.productId)
    const available = stockMap[line.productId] || 0
    const price = Number(product?.salePrice || 0)
    const quantity = Number(line.quantity) || 0
    return {
      ...line,
      product,
      available,
      price,
      lineTotal: calcLineTotal(quantity, price),
      quantityNumber: quantity,
      exceeds: quantity > available,
    }
  })

  const totals = calcInvoiceTotals(
    cartDetailed.map((line) => ({ quantity: line.quantityNumber, rate: line.price })),
    discount,
  )

  const cartInvalid =
    cartDetailed.length === 0 ||
    cartDetailed.some(
      (line) => !line.product || line.quantityNumber <= 0 || line.exceeds,
    )

  function clearErrors() {
    setErrors({})
    setLineErrors([])
  }

  function addProduct(product) {
    const available = stockMap[product.id] || 0
    if (available <= 0) {
      toast.info(`${product.productName} has no sellable stock available.`)
      return
    }

    const existing = cart.find((line) => line.productId === product.id)
    if (existing && Number(existing.quantity) >= available) {
      toast.info(`Only ${available} sellable unit${available === 1 ? '' : 's'} available for ${product.productName}.`)
      return
    }

    clearErrors()
    if (existing) {
      setCart((current) =>
        current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: String((Number(line.quantity) || 0) + 1) }
            : line,
        ),
      )
    } else {
      setCart((current) => [
        ...current,
        { key: makeId('CART'), productId: product.id, quantity: '1' },
      ])
    }
  }

  function updateQuantity(key, value) {
    clearErrors()
    setCart((current) =>
      current.map((line) => (line.key === key ? { ...line, quantity: value } : line)),
    )
  }

  function removeFromCart(key) {
    clearErrors()
    setCart((current) => current.filter((line) => line.key !== key))
  }

  function resetSale() {
    setCart([])
    setCustomerName('')
    setMobile('')
    setDiscount('')
    setPaymentMethod('cash')
    clearErrors()
    setInvoiceNumber(generateSaleInvoiceNumber(today))
  }

  async function handleConfirmSale() {
    if (saving || cartInvalid) return
    setSaving(true)
    try {
      const result = await Promise.resolve(
        createSale({
          invoiceNumber,
          customerName,
          mobile,
          discount,
          paymentMethod,
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      )

      if (!result.ok) {
        setErrors(result.errors || {})
        setLineErrors(result.lineErrors || [])
        toast.error('Please review the invoice before confirming the sale.')
        return
      }

      setReceipt(result.invoice)
      toast.success(`Sale ${result.invoice.invoiceNumber} completed. Stock updated using FEFO.`)
      resetSale()
    } finally {
      setSaving(false)
    }
  }

  function handlePrintReceipt() {
    if (!receipt) return
    try {
      printDocument(
        `Receipt ${receipt.invoiceNumber}`,
        buildReceiptHtml(receipt, settings.ownerName),
      )
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Point of sale"
        title="Sales & Billing"
        description="Build a customer invoice, validate stock and deduct the earliest-expiring batches first (FEFO)."
        actions={
          <>
            <Badge tone="brand" dot className="h-9 px-3">
              <ReceiptText size={13} />
              {invoiceNumber}
            </Badge>
            <Button variant="secondary" onClick={resetSale} disabled={!cart.length && !customerName}>
              <RefreshCw size={15} />
              New sale
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Add products"
              description="Search by name, SKU or brand. Expired stock is never shown as sellable."
              action={<Badge tone="slate">{filteredProducts.length} products</Badge>}
            />
            <div className="border-b border-slate-100 p-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search product name or SKU…"
              />
            </div>
            <div className="max-h-[350px] overflow-y-auto">
              {filteredProducts.length ? (
                <div className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const available = stockMap[product.id] || 0
                    const expiryMeta = getExpiryMeta(product.expiryDate, today)
                    const inCart = cart.find((line) => line.productId === product.id)
                    return (
                      <div
                        key={product.id}
                        className="flex flex-col gap-3 px-4 py-3 transition hover:bg-slate-50/60 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {product.productName}
                            </p>
                            <Badge tone={available > 0 ? 'green' : 'red'}>
                              {available > 0 ? `${formatNumber(available)} available` : 'No stock'}
                            </Badge>
                            {expiryMeta.status === 'expired' ? (
                              <Badge tone="red">Expired</Badge>
                            ) : expiryMeta.status === 'today' || expiryMeta.status === 'soon' ? (
                              <ExpiryBadge expiryDate={product.expiryDate} referenceDate={today} />
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {product.sku} · {formatWeightValue(product.packageWeight, product.unit)} ·{' '}
                            {formatCurrency(product.salePrice)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          {inCart ? (
                            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                              {inCart.quantity} in cart
                            </span>
                          ) : null}
                          <Button
                            size="sm"
                            variant={available > 0 ? 'soft' : 'secondary'}
                            disabled={available <= 0}
                            onClick={() => addProduct(product)}
                          >
                            <Plus size={13} />
                            Add
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={PackageSearch}
                  title="No products found"
                  message="Try a different product name or SKU."
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Current invoice"
              description="Quantities are checked against non-expired batch stock."
              action={<Badge tone="brand">{cartDetailed.length} items</Badge>}
            />
            {cartDetailed.length ? (
              <div className="divide-y divide-slate-100">
                {cartDetailed.map((line, index) => {
                  const lineError = lineErrors[index] || {}
                  return (
                    <div key={line.key} className="px-4 py-3.5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {line.product?.productName || 'Product'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {line.product?.sku} · {formatCurrency(line.price)} each ·{' '}
                            {formatNumber(line.available)} available
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <Input
                              type="number"
                              min="1"
                              max={line.available}
                              step="any"
                              value={line.quantity}
                              onChange={(event) => updateQuantity(line.key, event.target.value)}
                              invalid={Boolean(lineError.quantity) || line.exceeds}
                              aria-label={`Quantity for ${line.product?.productName}`}
                              className="!h-9 text-center"
                            />
                          </div>
                          <p className="w-24 text-right text-sm font-semibold text-slate-800">
                            {formatCurrency(line.lineTotal)}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFromCart(line.key)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove ${line.product?.productName}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      {line.exceeds || lineError.quantity ? (
                        <p className="mt-1.5 text-xs font-medium text-red-600">
                          {lineError.quantity ||
                            `Only ${formatNumber(line.available)} sellable unit${line.available === 1 ? '' : 's'} available.`}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={ShoppingCart}
                title="Cart is empty"
                message="Search the catalogue above and add products to start a bill."
              />
            )}
            {errors.items ? (
              <p className="border-t border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                {errors.items}
              </p>
            ) : null}
          </Card>

          <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-[11px] leading-5 text-sky-800">
            <ScanBarcode size={16} className="shrink-0 text-sky-600" />
            Sales deduct stock from the earliest-expiring eligible batch first. Expired batches are blocked and
            remain visible in Expiry Alerts for disposal.
          </div>
        </div>

        <Card className="lg:sticky lg:top-20">
          <CardHeader
            title="Invoice summary"
            description="Review before completing the sale"
            action={
              <button
                type="button"
                onClick={() => {
                  clearErrors()
                  setInvoiceNumber(generateSaleInvoiceNumber(today))
                }}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Generate a new invoice number"
                title="Generate a new invoice number"
              >
                <RefreshCw size={14} />
              </button>
            }
          />
          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Invoice number
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-800">{invoiceNumber}</p>
              {errors.invoiceNumber ? (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.invoiceNumber}</p>
              ) : null}
            </div>

            <div className="grid gap-3">
              <Field label="Customer Name" htmlFor="customerName" hint="Optional">
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Walk-in customer"
                />
              </Field>
              <Field label="Mobile Number" htmlFor="mobile" error={errors.mobile} hint="Optional">
                <Input
                  id="mobile"
                  type="tel"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  invalid={Boolean(errors.mobile)}
                  placeholder="10-digit mobile number"
                />
              </Field>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <label htmlFor="discount" className="shrink-0">
                  Discount (₹)
                </label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max={totals.subtotal}
                  step="0.01"
                  value={discount}
                  onChange={(event) => {
                    setDiscount(event.target.value)
                    setErrors((current) => {
                      if (!current.discount) return current
                      const next = { ...current }
                      delete next.discount
                      return next
                    })
                  }}
                  invalid={Boolean(errors.discount)}
                  placeholder="0.00"
                  className="!h-9 w-28 text-right"
                />
              </div>
              {errors.discount ? (
                <p className="text-right text-xs font-medium text-red-600">{errors.discount}</p>
              ) : null}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Grand total
                </span>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(totals.grandTotal)}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Payment method</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = PAYMENT_ICONS[method.value]
                  const active = paymentMethod === method.value
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${
                        active
                          ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                      aria-pressed={active}
                    >
                      <Icon size={16} />
                      {method.label}
                    </button>
                  )
                })}
              </div>
              {errors.paymentMethod ? (
                <p className="mt-1 text-xs font-medium text-red-600">{errors.paymentMethod}</p>
              ) : null}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleConfirmSale}
              loading={saving}
              disabled={saving || cartInvalid}
            >
              <ReceiptText size={16} />
              Confirm sale · {formatCurrency(totals.grandTotal)}
            </Button>
            {cartInvalid && cart.length ? (
              <p className="flex items-start gap-1.5 text-[11px] leading-5 text-amber-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Fix quantities that exceed available stock to confirm this sale.
              </p>
            ) : null}
            {errors.form ? (
              <p className="text-xs font-medium text-red-600">{errors.form}</p>
            ) : null}
            <p className="text-[10px] leading-4 text-slate-400">
              Stock is reduced only after the sale is confirmed. A receipt is generated for every completed invoice.
            </p>
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title="Sale completed"
        description="The invoice has been saved and stock has been updated."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setReceipt(null)}>
              Close
            </Button>
            <Button onClick={handlePrintReceipt}>
              <Printer size={15} />
              Print receipt
            </Button>
          </div>
        }
      >
        {receipt ? (
          <div className="bg-slate-50 p-5">
            <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-200 pb-4">
                <div>
                  <p className="text-base font-bold text-brand-900">
                    {settings.ownerName || 'Grocery Store'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Customer receipt</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[11px] font-semibold text-slate-700">
                    {receipt.invoiceNumber}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {formatDateTime(receipt.saleDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between py-3 text-[11px] text-slate-500">
                <span>{receipt.customerName || 'Walk-in customer'}</span>
                <span>{paymentLabel(receipt.paymentMethod)}</span>
              </div>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-y border-slate-100 text-[9px] uppercase tracking-wider text-slate-400">
                    <th className="py-1.5">Item</th>
                    <th className="py-1.5 text-right">Qty</th>
                    <th className="py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {receipt.items.map((item) => (
                    <tr key={`${receipt.id}-${item.productId}`}>
                      <td className="py-2 pr-2 text-slate-700">{item.productName}</td>
                      <td className="py-2 text-right text-slate-500">{formatNumber(item.quantity)}</td>
                      <td className="py-2 text-right font-medium text-slate-700">
                        {formatCurrency(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 space-y-1 border-t border-dashed border-slate-200 pt-3 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span>− {formatCurrency(receipt.discount)}</span>
                </div>
                <div className="flex justify-between pt-1 text-sm font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(receipt.grandTotal)}</span>
                </div>
              </div>
              <p className="mt-4 text-center text-[10px] text-slate-400">
                Thank you for shopping with us!
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
