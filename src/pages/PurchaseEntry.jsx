import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  PackagePlus,
  Plus,
  RotateCcw,
  ShoppingBasket,
  Trash2,
  Truck,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import {
  createPurchase,
  generatePurchaseInvoiceNumber,
} from '../services/purchaseService'
import { formatDateKey } from '../utils/dateUtils'
import {
  calcLineTotal,
  formatCurrency,
  formatNumber,
  formatWeightValue,
} from '../utils/calculations'
import { makeId } from '../utils/id'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input } from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'

const HISTORY_PAGE_SIZE = 8

function emptyLine() {
  return {
    key: makeId('LINE'),
    productId: '',
    quantity: '1',
    rate: '',
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
  }
}

export default function PurchaseEntry() {
  const { products, purchases, today } = useData()
  const toast = useToast()

  const [invoiceNumber, setInvoiceNumber] = useState(() => generatePurchaseInvoiceNumber(today))
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [supplierName, setSupplierName] = useState('')
  const [lines, setLines] = useState(() => [emptyLine()])
  const [errors, setErrors] = useState({})
  const [lineErrors, setLineErrors] = useState([])
  const [saving, setSaving] = useState(false)

  const [historySearch, setHistorySearch] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const orderTotal = lines.reduce(
    (total, line) => total + calcLineTotal(line.quantity, line.rate),
    0,
  )

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    return purchases
      .filter((purchase) => {
        const matchesSearch =
          !query ||
          [purchase.invoiceNumber, purchase.supplierName, purchase.productName, purchase.sku]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        const matchesFrom = !historyFrom || purchase.purchaseDate >= historyFrom
        const matchesTo = !historyTo || purchase.purchaseDate <= historyTo
        return matchesSearch && matchesFrom && matchesTo
      })
      .sort((a, b) => {
        const dateCompare = String(b.purchaseDate).localeCompare(String(a.purchaseDate))
        if (dateCompare !== 0) return dateCompare
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      })
  }, [purchases, historySearch, historyFrom, historyTo])

  const historyPageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyPageCount)
  const visibleHistory = filteredHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  )
  const historyTotal = filteredHistory.reduce(
    (total, purchase) => total + Number(purchase.lineTotal || 0),
    0,
  )

  function updateLine(key, field, value) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        if (field === 'productId') {
          const product = productMap.get(value)
          return {
            ...line,
            productId: value,
            rate: product ? String(product.purchasePrice) : '',
            manufacturingDate: product?.manufacturingDate || '',
            expiryDate: product?.expiryDate || '',
          }
        }
        return { ...line, [field]: value }
      }),
    )
    setErrors((current) => {
      if (!current.items) return current
      const next = { ...current }
      delete next.items
      return next
    })
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()])
  }

  function removeLine(key) {
    setLines((current) => {
      if (current.length === 1) return current
      return current.filter((line) => line.key !== key)
    })
  }

  function resetForm(nextInvoice = generatePurchaseInvoiceNumber(today)) {
    setInvoiceNumber(nextInvoice)
    setPurchaseDate(today)
    setSupplierName('')
    setLines([emptyLine()])
    setErrors({})
    setLineErrors([])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const result = await Promise.resolve(
        createPurchase({
          invoiceNumber,
          purchaseDate,
          supplierName,
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            rate: line.rate,
            batchNumber: line.batchNumber,
            manufacturingDate: line.manufacturingDate,
            expiryDate: line.expiryDate,
          })),
        }),
      )

      if (!result.ok) {
        setErrors(result.errors || {})
        setLineErrors(result.lineErrors || [])
        toast.error('Please fix the highlighted purchase details.')
        return
      }

      toast.success(
        `Purchase ${result.invoiceNumber} saved. Stock updated for ${result.lines.length} line${result.lines.length === 1 ? '' : 's'}.`,
      )
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  function resetHistoryFilters() {
    setHistorySearch('')
    setHistoryFrom('')
    setHistoryTo('')
    setHistoryPage(1)
  }

  if (!products.length) {
    return (
      <div>
        <PageHeader
          title="Purchase Entry"
          description="Record supplier invoices and add stock in expiry-tracked batches."
        />
        <Card>
          <EmptyState
            icon={PackagePlus}
            title="Add a product first"
            message="Purchases need at least one product in the catalogue. Create a product, then record its supplier invoice here."
            action={
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                <PackagePlus size={15} />
                Go to Product Management
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Stock in"
        title="Purchase Entry"
        description="Record supplier invoices. Every purchase line creates a separate batch and increases current stock."
        actions={
          <Button variant="secondary" onClick={() => resetForm()}>
            <RotateCcw size={15} />
            New invoice
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="New purchase invoice"
          description="Multiple products and batches can be recorded on one invoice."
          action={
            <Badge tone="brand" dot>
              {lines.length} line{lines.length === 1 ? '' : 's'}
            </Badge>
          }
        />
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Purchase Invoice Number" htmlFor="purchaseInvoice" required error={errors.invoiceNumber}>
              <Input
                id="purchaseInvoice"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                invalid={Boolean(errors.invoiceNumber)}
                className="font-mono"
              />
            </Field>
            <Field label="Purchase Date" htmlFor="purchaseDate" required error={errors.purchaseDate}>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                invalid={Boolean(errors.purchaseDate)}
              />
            </Field>
            <Field
              label="Supplier Name"
              htmlFor="supplierName"
              required
              error={errors.supplierName}
              className="sm:col-span-2"
            >
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                invalid={Boolean(errors.supplierName)}
                placeholder="e.g. Metro Wholesale"
              />
            </Field>
          </div>

          <div className="space-y-3 p-5">
            {errors.items ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {errors.items}
              </p>
            ) : null}

            {lines.map((line, index) => {
              const product = productMap.get(line.productId)
              const errorsForLine = lineErrors[index] || {}
              return (
                <div
                  key={line.key}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                        {index + 1}
                      </span>
                      <p className="truncate text-xs font-semibold text-slate-700">
                        {product ? product.productName : 'Select a product'}
                      </p>
                      {product ? (
                        <span className="hidden text-[10px] text-slate-400 sm:inline">
                          {product.sku} · {formatWeightValue(product.packageWeight, product.unit)}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Product"
                      htmlFor={`product-${line.key}`}
                      error={errorsForLine.productId}
                      className="sm:col-span-2"
                    >
                      <select
                        id={`product-${line.key}`}
                        value={line.productId}
                        onChange={(event) => updateLine(line.key, 'productId', event.target.value)}
                        className={`h-10 w-full rounded-xl border bg-white px-3 text-sm shadow-sm outline-none transition focus:ring-4 ${
                          errorsForLine.productId
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                            : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'
                        }`}
                      >
                        <option value="">Select product…</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.productName} ({product.sku})
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Quantity"
                      htmlFor={`quantity-${line.key}`}
                      error={errorsForLine.quantity}
                    >
                      <Input
                        id={`quantity-${line.key}`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, 'quantity', event.target.value)}
                        invalid={Boolean(errorsForLine.quantity)}
                      />
                    </Field>
                    <Field label="Purchase Rate (₹)" htmlFor={`rate-${line.key}`} error={errorsForLine.rate}>
                      <Input
                        id={`rate-${line.key}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.rate}
                        onChange={(event) => updateLine(line.key, 'rate', event.target.value)}
                        invalid={Boolean(errorsForLine.rate)}
                        placeholder="0.00"
                      />
                    </Field>
                    <Field label="Line Total">
                      <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-100/70 px-3.5 text-sm font-semibold text-slate-700">
                        {formatCurrency(calcLineTotal(line.quantity, line.rate))}
                      </div>
                    </Field>
                    <Field
                      label="Batch Number"
                      htmlFor={`batch-${line.key}`}
                      hint="Optional — auto-generated if blank."
                    >
                      <Input
                        id={`batch-${line.key}`}
                        value={line.batchNumber}
                        onChange={(event) => updateLine(line.key, 'batchNumber', event.target.value)}
                        placeholder="e.g. MP-1026"
                      />
                    </Field>
                    <Field
                      label="Manufacturing Date"
                      htmlFor={`mfg-${line.key}`}
                      error={errorsForLine.manufacturingDate}
                    >
                      <Input
                        id={`mfg-${line.key}`}
                        type="date"
                        value={line.manufacturingDate}
                        onChange={(event) =>
                          updateLine(line.key, 'manufacturingDate', event.target.value)
                        }
                        invalid={Boolean(errorsForLine.manufacturingDate)}
                      />
                    </Field>
                    <Field
                      label="Expiry Date"
                      htmlFor={`expiry-${line.key}`}
                      error={errorsForLine.expiryDate}
                      className="sm:col-span-2"
                    >
                      <Input
                        id={`expiry-${line.key}`}
                        type="date"
                        value={line.expiryDate}
                        onChange={(event) => updateLine(line.key, 'expiryDate', event.target.value)}
                        invalid={Boolean(errorsForLine.expiryDate)}
                      />
                    </Field>
                  </div>
                </div>
              )
            })}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button variant="secondary" size="sm" onClick={addLine}>
                <Plus size={14} />
                Add another product
              </Button>
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Invoice total
                  </p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(orderTotal)}</p>
                </div>
                <Button type="submit" loading={saving} disabled={saving}>
                  <ShoppingBasket size={15} />
                  Save purchase
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="Purchase history"
          description="Recorded purchase lines, newest first."
          action={
            <Badge tone="slate">
              {formatCurrency(historyTotal)} total
            </Badge>
          }
        />
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-end">
          <SearchInput
            value={historySearch}
            onChange={(value) => {
              setHistorySearch(value)
              setHistoryPage(1)
            }}
            placeholder="Search invoice, supplier, product or SKU…"
            className="lg:max-w-sm lg:flex-1"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <div>
              <label htmlFor="history-from" className="mb-1 block text-[10px] font-semibold text-slate-500">
                From
              </label>
              <Input
                id="history-from"
                type="date"
                value={historyFrom}
                onChange={(event) => {
                  setHistoryFrom(event.target.value)
                  setHistoryPage(1)
                }}
                className="sm:w-40"
              />
            </div>
            <div>
              <label htmlFor="history-to" className="mb-1 block text-[10px] font-semibold text-slate-500">
                To
              </label>
              <Input
                id="history-to"
                type="date"
                value={historyTo}
                onChange={(event) => {
                  setHistoryTo(event.target.value)
                  setHistoryPage(1)
                }}
                className="sm:w-40"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2 self-end sm:mt-5"
              onClick={resetHistoryFilters}
            >
              <RotateCcw size={14} />
              Reset
            </Button>
          </div>
        </div>

        {visibleHistory.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleHistory.map((purchase) => (
                    <tr key={purchase.id} className="text-xs transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">
                        {purchase.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateKey(purchase.purchaseDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{purchase.supplierName}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{purchase.productName}</p>
                        <p className="text-[10px] text-slate-400">{purchase.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatNumber(purchase.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(purchase.rate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(purchase.lineTotal)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                        {purchase.batchNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateKey(purchase.expiryDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safeHistoryPage}
              pageSize={HISTORY_PAGE_SIZE}
              totalItems={filteredHistory.length}
              onPageChange={setHistoryPage}
              itemLabel="purchase lines"
            />
          </>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title={historySearch || historyFrom || historyTo ? 'No matching purchases' : 'No purchases yet'}
            message={
              historySearch || historyFrom || historyTo
                ? 'Adjust the invoice search or date range.'
                : 'Save your first supplier invoice above. Purchase lines will appear here.'
            }
            action={
              historySearch || historyFrom || historyTo ? (
                <Button variant="secondary" onClick={resetHistoryFilters}>
                  <RotateCcw size={14} />
                  Reset filters
                </Button>
              ) : null
            }
          />
        )}
      </Card>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
        <Truck size={13} />
        Each purchase line keeps its own batch and expiry date. Existing batch expiry dates are never overwritten.
      </p>
    </div>
  )
}
