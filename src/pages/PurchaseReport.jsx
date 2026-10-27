import { useMemo, useState } from 'react'
import { ClipboardList, FileDown, Printer } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import {
  formatDateKey,
  getMonthStartKey,
  getPeriodKey,
  getPeriodLabel,
} from '../utils/dateUtils'
import {
  formatCurrency,
  formatNumber,
  sumBy,
} from '../utils/calculations'
import { exportCsv } from '../utils/csv'
import { escapeHtml, printDocument } from '../utils/print'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import StatCard from '../components/ui/StatCard'
import PeriodBarChart from '../components/reports/PeriodBarChart'
import ReportFilters from '../components/reports/ReportFilters'

const PAGE_SIZE = 12

export default function PurchaseReport() {
  const { purchases, settings, today } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(() => getMonthStartKey(today))
  const [to, setTo] = useState(today)
  const [grouping, setGrouping] = useState('daily')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return purchases
      .filter((purchase) => {
        const matchesSearch =
          !query ||
          [purchase.invoiceNumber, purchase.supplierName, purchase.productName, purchase.sku]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query))
        const matchesFrom = !from || purchase.purchaseDate >= from
        const matchesTo = !to || purchase.purchaseDate <= to
        return matchesSearch && matchesFrom && matchesTo
      })
      .sort((a, b) => {
        const dateCompare = String(b.purchaseDate).localeCompare(String(a.purchaseDate))
        if (dateCompare !== 0) return dateCompare
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      })
  }, [purchases, search, from, to])

  const summary = useMemo(() => {
    const groups = new Map()
    filtered.forEach((purchase) => {
      const key = getPeriodKey(purchase.purchaseDate, grouping)
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: getPeriodLabel(key, grouping),
          invoices: new Set(),
          lines: 0,
          quantity: 0,
          value: 0,
        })
      }
      const group = groups.get(key)
      group.invoices.add(purchase.invoiceNumber)
      group.lines += 1
      group.quantity += Number(purchase.quantity || 0)
      group.value += Number(purchase.lineTotal || 0)
    })
    return [...groups.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)))
  }, [filtered, grouping])

  const summaryDisplay = useMemo(() => [...summary].reverse(), [summary])

  const totals = useMemo(
    () => ({
      value: sumBy(filtered, (purchase) => purchase.lineTotal),
      quantity: sumBy(filtered, (purchase) => purchase.quantity),
      invoices: new Set(filtered.map((purchase) => purchase.invoiceNumber)).size,
      lines: filtered.length,
    }),
    [filtered],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function resetFilters() {
    setSearch('')
    setFrom(getMonthStartKey(today))
    setTo(today)
    setGrouping('daily')
    setPage(1)
  }

  function changeSearch(value) {
    setSearch(value)
    setPage(1)
  }

  function changeFrom(value) {
    setFrom(value)
    setPage(1)
  }

  function changeTo(value) {
    setTo(value)
    setPage(1)
  }

  function changeGrouping(value) {
    setGrouping(value)
    setPage(1)
  }

  function handleExport() {
    if (!filtered.length) {
      toast.info('There are no purchase lines to export for this selection.')
      return
    }
    exportCsv(
      `purchase-report-${from || 'all'}-to-${to || 'all'}.csv`,
      [
        'Invoice Number',
        'Purchase Date',
        'Supplier',
        'Product Name',
        'SKU',
        'Quantity Purchased',
        'Purchase Rate',
        'Total Amount',
        'Batch Number',
        'Expiry Date',
      ],
      filtered.map((purchase) => [
        purchase.invoiceNumber,
        purchase.purchaseDate,
        purchase.supplierName,
        purchase.productName,
        purchase.sku,
        purchase.quantity,
        purchase.rate,
        purchase.lineTotal,
        purchase.batchNumber || '',
        purchase.expiryDate || '',
      ]),
    )
    toast.success('Purchase report CSV exported.')
  }

  function handlePrint() {
    if (!filtered.length) {
      toast.info('There are no purchase lines to print for this selection.')
      return
    }
    const rows = filtered
      .map(
        (purchase) => `<tr>
  <td>${escapeHtml(purchase.invoiceNumber)}</td>
  <td>${escapeHtml(formatDateKey(purchase.purchaseDate))}</td>
  <td>${escapeHtml(purchase.supplierName)}</td>
  <td>${escapeHtml(purchase.productName)}</td>
  <td>${escapeHtml(purchase.sku)}</td>
  <td class="num">${formatNumber(purchase.quantity)}</td>
  <td class="num">${escapeHtml(formatCurrency(purchase.rate))}</td>
  <td class="num">${escapeHtml(formatCurrency(purchase.lineTotal))}</td>
  <td>${escapeHtml(purchase.batchNumber || '—')}</td>
  <td>${escapeHtml(formatDateKey(purchase.expiryDate))}</td>
</tr>`,
      )
      .join('')

    const summaryRows = summaryDisplay
      .map(
        (row) => `<tr>
  <td>${escapeHtml(row.label)}</td>
  <td class="num">${row.invoices.size}</td>
  <td class="num">${row.lines}</td>
  <td class="num">${formatNumber(row.quantity)}</td>
  <td class="num">${escapeHtml(formatCurrency(row.value))}</td>
</tr>`,
      )
      .join('')

    printDocument(
      'Purchase Report',
      `<div class="doc-header">
  <div><h1>${escapeHtml(settings.ownerName || 'Grocery Store')}</h1><p>Purchase Report</p></div>
  <div class="meta"><strong>${escapeHtml(formatDateKey(from))} – ${escapeHtml(formatDateKey(to))}</strong><p>${filtered.length} lines · ${totals.invoices} invoices</p></div>
</div>
<table>
  <thead><tr><th>Invoice</th><th>Date</th><th>Supplier</th><th>Product</th><th>SKU</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Total</th><th>Batch</th><th>Expiry</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Total quantity</span><strong>${formatNumber(totals.quantity)}</strong></div>
  <div><span>Purchase lines</span><strong>${totals.lines}</strong></div>
  <div class="grand"><span>Total purchase value</span><span>${escapeHtml(formatCurrency(totals.value))}</span></div>
</div>
<h2 style="margin-top:26px;font-size:15px;color:#14532d;">${escapeHtml(grouping.charAt(0).toUpperCase() + grouping.slice(1))} summary</h2>
<table>
  <thead><tr><th>Period</th><th class="num">Invoices</th><th class="num">Lines</th><th class="num">Quantity</th><th class="num">Value</th></tr></thead>
  <tbody>${summaryRows}</tbody>
</table>
<p class="note">Generated from saved LocalStorage purchase records on ${escapeHtml(formatDateKey(today))}.</p>`,
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Purchase Report"
        description="Every purchase line, calculated from saved purchase transactions. Filter by date, search products and export or print."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport}>
              <FileDown size={15} />
              Export CSV
            </Button>
            <Button variant="secondary" onClick={handlePrint}>
              <Printer size={15} />
              Print
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total purchase value" value={formatCurrency(totals.value)} icon={ClipboardList} tone="brand" />
        <StatCard label="Invoices" value={formatNumber(totals.invoices)} tone="blue" hint="Unique invoice numbers" />
        <StatCard label="Purchase lines" value={formatNumber(totals.lines)} tone="slate" hint="Each line is a batch" />
        <StatCard label="Units purchased" value={formatNumber(totals.quantity)} tone="amber" hint="Across all lines" />
      </div>

      <Card>
        <CardHeader
          title="Purchase records"
          description={`${formatDateKey(from)} – ${formatDateKey(to)}`}
          action={<Badge tone="slate">{filtered.length} matching lines</Badge>}
        />
        <ReportFilters
          search={search}
          onSearch={changeSearch}
          from={from}
          to={to}
          onFrom={changeFrom}
          onTo={changeTo}
          grouping={grouping}
          onGrouping={changeGrouping}
          onReset={resetFilters}
          searchPlaceholder="Search invoice, supplier, product or SKU…"
        />

        {filtered.length ? (
          <>
            {summary.length > 1 ? (
              <div className="border-b border-slate-100 px-3 pt-1">
                <PeriodBarChart
                  data={summary.map((row) => ({ label: row.label, value: row.value }))}
                  name="Purchases"
                  color="#15803d"
                />
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Purchase Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Purchase Rate</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((purchase) => (
                    <tr key={purchase.id} className="text-xs transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">
                        {purchase.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateKey(purchase.purchaseDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{purchase.supplierName}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">{purchase.productName}</td>
                      <td className="px-4 py-3 text-slate-500">{purchase.sku}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatNumber(purchase.quantity)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(purchase.rate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(purchase.lineTotal)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                        {purchase.batchNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateKey(purchase.expiryDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs">
              <span className="text-slate-500">Filtered total purchase value</span>
              <span className="text-base font-bold text-slate-900">{formatCurrency(totals.value)}</span>
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              totalItems={filtered.length}
              onPageChange={setPage}
              itemLabel="lines"
            />

            <div className="overflow-x-auto border-t border-slate-100">
              <div className="px-5 pb-1 pt-4">
                <h3 className="text-xs font-semibold text-slate-700">
                  {grouping === 'daily' ? 'Daily' : grouping === 'weekly' ? 'Weekly' : 'Monthly'} summary
                </h3>
              </div>
              <table className="w-full min-w-[680px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5">Period</th>
                    <th className="px-5 py-2.5 text-right">Invoices</th>
                    <th className="px-5 py-2.5 text-right">Lines</th>
                    <th className="px-5 py-2.5 text-right">Quantity</th>
                    <th className="px-5 py-2.5 text-right">Purchase value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryDisplay.map((row) => (
                    <tr key={row.key} className="text-xs">
                      <td className="px-5 py-2.5 font-medium text-slate-700">{row.label}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{row.invoices.size}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{row.lines}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{formatNumber(row.quantity)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-slate-800">
                        {formatCurrency(row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No purchase records found"
            message="Change the date range or search term, or record a new purchase entry."
          />
        )}
      </Card>
    </div>
  )
}
