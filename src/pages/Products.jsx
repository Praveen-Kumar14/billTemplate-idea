import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Clock,
  Edit2,
  Package,
  PackagePlus,
  Plus,
  RotateCcw,
  Trash2,
  TrendingDown,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import {
  createProduct,
  deleteProduct,
  updateProduct,
  validateProductInput,
} from '../services/productService'
import { getProductExpiryInfo } from '../services/expiryService'
import { formatDateKey } from '../utils/dateUtils'
import {
  formatCurrency,
  formatWeightValue,
  getStockStatus,
} from '../utils/calculations'
import {
  CATEGORY_OPTIONS,
  EXPIRY_FILTERS,
  STOCK_FILTERS,
  UNIT_OPTIONS,
} from '../utils/constants'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import ExpiryBadge from '../components/ui/ExpiryBadge'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import StatCard from '../components/ui/StatCard'
import StockBadge from '../components/ui/StockBadge'

const PAGE_SIZE = 8

const EMPTY_FORM = {
  productName: '',
  sku: '',
  category: '',
  brand: '',
  unit: 'piece',
  packageWeight: '',
  purchasePrice: '',
  salePrice: '',
  openingStock: '',
  currentStock: '',
  manufacturingDate: '',
  expiryDate: '',
  supplierName: '',
  description: '',
}

function productToForm(product) {
  return {
    productName: product.productName || '',
    sku: product.sku || '',
    category: product.category || '',
    brand: product.brand || '',
    unit: product.unit || 'piece',
    packageWeight: product.packageWeight ?? '',
    purchasePrice: product.purchasePrice ?? '',
    salePrice: product.salePrice ?? '',
    openingStock: product.openingStock ?? '',
    currentStock: product.currentStock ?? '',
    manufacturingDate: product.manufacturingDate || '',
    expiryDate: product.expiryDate || '',
    supplierName: product.supplierName || '',
    description: product.description || '',
  }
}

export default function Products() {
  const { products, batches, today } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)

  const categories = useMemo(() => {
    return [...new Set(products.map((product) => product.category).filter(Boolean))].sort()
  }, [products])

  const enriched = useMemo(() => {
    return products.map((product) => ({
      ...product,
      expiryInfo: getProductExpiryInfo(product, batches, today),
      stockInfo: getStockStatus(product.currentStock, product.openingStock),
    }))
  }, [products, batches, today])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return enriched.filter((product) => {
      const matchesQuery =
        !query ||
        [product.productName, product.sku, product.brand, product.supplierName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      const matchesCategory =
        categoryFilter === 'all' || product.category === categoryFilter
      const matchesStock =
        stockFilter === 'all' || product.stockInfo.status === stockFilter
      const expiryStatus = product.expiryInfo.status
      const matchesExpiry =
        expiryFilter === 'all' ||
        (expiryFilter === 'safe' && expiryStatus === 'safe') ||
        (expiryFilter === 'soon' && ['soon', 'today'].includes(expiryStatus)) ||
        (expiryFilter === 'today' && expiryStatus === 'today') ||
        (expiryFilter === 'expired' && expiryStatus === 'expired')
      return matchesQuery && matchesCategory && matchesStock && matchesExpiry
    })
  }, [enriched, search, categoryFilter, stockFilter, expiryFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const stats = useMemo(
    () => ({
      total: products.length,
      low: enriched.filter((product) => product.stockInfo.status === 'low').length,
      expiring: enriched.filter((product) => ['soon', 'today'].includes(product.expiryInfo.status))
        .length,
      expired: enriched.filter((product) => product.expiryInfo.status === 'expired').length,
    }),
    [enriched, products.length],
  )

  const hasFilters =
    search || categoryFilter !== 'all' || stockFilter !== 'all' || expiryFilter !== 'all'

  function openCreate() {
    setEditingProduct(null)
    setForm({ ...EMPTY_FORM })
    setErrors({})
    setFormOpen(true)
  }

  function openEdit(product) {
    setEditingProduct(product)
    setForm(productToForm(product))
    setErrors({})
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingProduct(null)
    setErrors({})
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const payload = { ...form }
    if (String(payload.currentStock ?? '').trim() === '') {
      payload.currentStock = payload.openingStock
    }
    if (String(payload.openingStock ?? '').trim() === '') {
      payload.openingStock = payload.currentStock
    }
    const nextErrors = validateProductInput(payload, products, editingProduct?.id)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    const result = editingProduct
      ? updateProduct(editingProduct.id, payload)
      : createProduct(payload)

    if (!result.ok) {
      setErrors(result.errors || {})
      return
    }

    toast.success(
      editingProduct
        ? `${result.product.productName} updated.`
        : `${result.product.productName} added to the catalogue.`,
    )
    closeForm()
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteProduct(deleteTarget.id)
    toast.success(`${deleteTarget.productName} deleted.`)
    setDeleteTarget(null)
  }

  function resetFilters() {
    setSearch('')
    setCategoryFilter('all')
    setStockFilter('all')
    setExpiryFilter('all')
    setPage(1)
  }

  function changeSearch(value) {
    setSearch(value)
    setPage(1)
  }

  function changeCategory(value) {
    setCategoryFilter(value)
    setPage(1)
  }

  function changeStock(value) {
    setStockFilter(value)
    setPage(1)
  }

  function changeExpiry(value) {
    setExpiryFilter(value)
    setPage(1)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Product Management"
        description="Maintain product details, pricing, stock and expiry dates. Every product is saved in this browser's LocalStorage."
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} />
            Add Product
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total products" value={stats.total} icon={Package} tone="brand" />
        <StatCard label="Low stock" value={stats.low} icon={TrendingDown} tone="amber" />
        <StatCard label="Expiring in 5 days" value={stats.expiring} icon={Clock} tone="amber" />
        <StatCard label="Expired" value={stats.expired} icon={AlertTriangle} tone="red" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onChange={changeSearch}
            placeholder="Search product, SKU, brand or supplier…"
            className="lg:max-w-sm lg:flex-1"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:ml-auto lg:w-auto">
            <Select
              value={categoryFilter}
              onChange={(event) => changeCategory(event.target.value)}
              aria-label="Filter by category"
              className="min-w-[120px]"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
            <Select
              value={stockFilter}
              onChange={(event) => changeStock(event.target.value)}
              aria-label="Filter by stock status"
            >
              {STOCK_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </Select>
            <Select
              value={expiryFilter}
              onChange={(event) => changeExpiry(event.target.value)}
              aria-label="Filter by expiry status"
              className="col-span-2 sm:col-span-1"
            >
              {EXPIRY_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </Select>
          </div>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw size={14} />
              Reset
            </Button>
          ) : null}
        </div>

        {visible.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Package</th>
                    <th className="px-4 py-3 text-right">Purchase</th>
                    <th className="px-4 py-3 text-right">Sale</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((product) => (
                    <tr key={product.id} className="text-xs transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{product.productName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {product.brand || 'No brand'}
                          {product.supplierName ? ` · ${product.supplierName}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{product.category}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatWeightValue(product.packageWeight, product.unit)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(product.purchasePrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(product.salePrice)}
                      </td>
                      <td className="px-4 py-3">
                        <StockBadge
                          currentStock={product.currentStock}
                          openingStock={product.openingStock}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <ExpiryBadge
                            expiryDate={product.expiryInfo.expiryDate}
                            referenceDate={today}
                          />
                          <span className="text-[10px] text-slate-400">
                            {formatDateKey(product.expiryInfo.expiryDate)}
                            {product.expiryInfo.batchCount > 1
                              ? ` · ${product.expiryInfo.batchCount} batches`
                              : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-brand-50 hover:text-brand-700"
                            aria-label={`Edit ${product.productName}`}
                            title="Edit product"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={`Delete ${product.productName}`}
                            title="Delete product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              totalItems={filtered.length}
              onPageChange={setPage}
              itemLabel="products"
            />
          </>
        ) : (
          <EmptyState
            icon={PackagePlus}
            title={hasFilters ? 'No products match these filters' : 'No products yet'}
            message={
              hasFilters
                ? 'Try a different search or reset the filters to see the full catalogue.'
                : 'Add your first grocery product to begin tracking stock and expiry dates.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={resetFilters}>
                  <RotateCcw size={14} />
                  Reset filters
                </Button>
              ) : (
                <Button onClick={openCreate}>
                  <Plus size={15} />
                  Add Product
                </Button>
              )
            }
          />
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        size="lg"
        title={editingProduct ? 'Edit product' : 'Add product'}
        description={
          editingProduct
            ? 'Update product details. Changing the current stock creates a stock adjustment batch.'
            : 'Create a product with opening stock. This also creates its first expiry-tracked batch.'
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" form="product-form">
              {editingProduct ? 'Save changes' : 'Save product'}
            </Button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product Name" htmlFor="productName" required error={errors.productName}>
              <Input
                id="productName"
                value={form.productName}
                onChange={(event) => updateField('productName', event.target.value)}
                invalid={Boolean(errors.productName)}
                placeholder="e.g. Amul Milk Powder"
                autoFocus
              />
            </Field>
            <Field
              label="SKU / Product Code"
              htmlFor="sku"
              required
              error={errors.sku}
              hint="Must be unique across the catalogue."
            >
              <Input
                id="sku"
                value={form.sku}
                onChange={(event) => updateField('sku', event.target.value)}
                invalid={Boolean(errors.sku)}
                placeholder="e.g. MILK-AMU-500"
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Category" htmlFor="category" required error={errors.category}>
              <Input
                id="category"
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                invalid={Boolean(errors.category)}
                placeholder="Select or type a category"
                list="product-categories"
              />
              <datalist id="product-categories">
                {[...new Set([...CATEGORY_OPTIONS, ...categories])].map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
            <Field label="Brand" htmlFor="brand">
              <Input
                id="brand"
                value={form.brand}
                onChange={(event) => updateField('brand', event.target.value)}
                placeholder="e.g. Amul"
              />
            </Field>
            <Field label="Unit Type" htmlFor="unit" required error={errors.unit}>
              <Select
                id="unit"
                value={form.unit}
                onChange={(event) => updateField('unit', event.target.value)}
                invalid={Boolean(errors.unit)}
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Package Weight / Volume"
              htmlFor="packageWeight"
              required
              error={errors.packageWeight}
            >
              <Input
                id="packageWeight"
                type="number"
                min="0"
                step="any"
                value={form.packageWeight}
                onChange={(event) => updateField('packageWeight', event.target.value)}
                invalid={Boolean(errors.packageWeight)}
                placeholder="e.g. 500"
              />
            </Field>
            <Field label="Purchase Price (₹)" htmlFor="purchasePrice" required error={errors.purchasePrice}>
              <Input
                id="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(event) => updateField('purchasePrice', event.target.value)}
                invalid={Boolean(errors.purchasePrice)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Sale Price (₹)" htmlFor="salePrice" required error={errors.salePrice}>
              <Input
                id="salePrice"
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(event) => updateField('salePrice', event.target.value)}
                invalid={Boolean(errors.salePrice)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Opening Stock Quantity" htmlFor="openingStock" error={errors.openingStock}>
              <Input
                id="openingStock"
                type="number"
                min="0"
                step="any"
                value={form.openingStock}
                onChange={(event) => updateField('openingStock', event.target.value)}
                invalid={Boolean(errors.openingStock)}
                placeholder="0"
              />
            </Field>
            <Field
              label="Current Stock Quantity"
              htmlFor="currentStock"
              required
              error={errors.currentStock}
              hint="Stock is synced with purchase and sales transactions."
            >
              <Input
                id="currentStock"
                type="number"
                min="0"
                step="any"
                value={form.currentStock}
                onChange={(event) => updateField('currentStock', event.target.value)}
                invalid={Boolean(errors.currentStock)}
                placeholder="0"
              />
            </Field>
            <Field label="Manufacturing Date" htmlFor="manufacturingDate" error={errors.manufacturingDate}>
              <Input
                id="manufacturingDate"
                type="date"
                value={form.manufacturingDate}
                onChange={(event) => updateField('manufacturingDate', event.target.value)}
                invalid={Boolean(errors.manufacturingDate)}
              />
            </Field>
            <Field label="Expiry Date" htmlFor="expiryDate" required error={errors.expiryDate}>
              <Input
                id="expiryDate"
                type="date"
                value={form.expiryDate}
                onChange={(event) => updateField('expiryDate', event.target.value)}
                invalid={Boolean(errors.expiryDate)}
              />
            </Field>
            <Field label="Supplier Name" htmlFor="supplierName">
              <Input
                id="supplierName"
                value={form.supplierName}
                onChange={(event) => updateField('supplierName', event.target.value)}
                placeholder="Optional supplier"
              />
            </Field>
          </div>
          <Field label="Product Description" htmlFor="description">
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Optional notes about this product"
              rows={2}
            />
          </Field>
          {errors.form ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {errors.form}
            </p>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.productName || 'product'}?`}
        message="This removes the product and all of its batches from the catalogue. Existing purchase and sales history is kept for reporting."
        confirmLabel="Delete product"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
