import { useMemo, useState } from 'react'
import { BarChart3, FileDown, Printer, Receipt, TrendingUp, Users } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { flattenSaleLines } from '../services/salesService'
import {
  formatDateKey,
  formatDateTime,
  getMonthStartKey,
  getPeriodKey,
  getPeriodLabel,
} from '../utils/dateUtils'
import { formatCurrency, formatNumber, round2, sumBy } from '../utils/calculations'
import { PAYMENT_METHODS } from '../utils/constants'
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

function paymentLabel(value) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label || value
}

export default function SalesReport() {
  const { sales, settings, today } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(() => getMonthStartKey(today))
  const [to, setTo] = useState(today)
  const [grouping, setGrouping] = useState('daily')
  const [page, setPage] = useState(1)

  const filteredLines = useMemo(() => {
    const query = search.trim().toLowerCase()
    return flattenSaleLines(sales)
      .filter((line) => {
        const matchesFrom = !from || line.dateKey >= from
        const matchesTo = !to || line.dateKey <= to
        if (!matchesFrom || !matchesTo) return false
        if (!query) return true
        const headerMatch = [
          line.invoiceNumber,
          line.customerName,
          line.mobile,
          line.paymentMethod,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
        if (headerMatch) return true
        return [line.productName, line.sku]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      })
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
  }, [sales, search, from, to])

  const invoiceSummary = useMemo(() => {
    const invoices = new Map()
    filteredLines.forEach((line) => {
      if (!invoices.has(line.invoiceId)) {
        invoices.set(line.invoiceId, {
          invoiceId: line.invoiceId,
          invoiceNumber: line.invoiceNumber,
          dateKey: line.dateKey,
          subtotal: Number(line.subtotal || 0),
          discount: Number(line.discount || 0),
          matchedSubtotal: 0,
          units: 0,
        })
      }
      const invoice = invoices.get(line.invoiceId)
      invoice.matchedSubtotal = round2(invoice.matchedSubtotal + Number(line.lineTotal || 0))
      invoice.units = round2(invoice.units + Number(line.quantity || 0))
    })

    return [...invoices.values()].map((invoice) => {
      const ratio =
        invoice.subtotal > 0
          ? Math.min(1, invoice.matchedSubtotal / invoice.subtotal)
          : 0
      const discountShare = round2(invoice.discount * ratio)
      return {
        ...invoice,
        discountShare,
        net: round2(invoice.matchedSubtotal - discountShare),
      }
    })
  }, [filteredLines])

  const summary = useMemo(() => {
    const groups = new Map()
    invoiceSummary.forEach((invoice) => {
      const key = getPeriodKey(invoice.dateKey, grouping)
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: getPeriodLabel(key, grouping),
          invoices: 0,
          units: 0,
          gross: 0,
          discount: 0,
          net: 0,
        })
      }
      const group = groups.get(key)
      group.invoices += 1
      group.units = round2(group.units + invoice.units)
      group.gross = round2(group.gross + invoice.matchedSubtotal)
      group.discount = round2(group.discount + invoice.discountShare)
      group.net = round2(group.net + invoice.net)
    })
    return [...groups.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)))
  }, [invoiceSummary, grouping])

  const summaryDisplay = useMemo(() => [...summary].reverse(), [summary])

  const totals = useMemo(
    () => ({
      net: sumBy(invoiceSummary, (invoice) => invoice.net),
      gross: sumBy(invoiceSummary, (invoice) => invoice.matchedSubtotal),
      discount: sumBy(invoiceSummary, (invoice) => invoice.discountShare),
      units: sumBy(filteredLines, (line) => line.quantity),
      invoices: invoiceSummary.length,
      average: invoiceSummary.length
        ? sumBy(invoiceSummary, (invoice) => invoice.net) / invoiceSummary.length
        : 0,
    }),
    [invoiceSummary, filteredLines],
  )

  const pageCount = Math.max(1, Math.ceil(filteredLines.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filteredLines.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
    if (!filteredLines.length) {
      toast.info('There are no sales to export for this selection.')
      return
    }
    const invoiceById = new Map(
      invoiceSummary.map((invoice) => [invoice.invoiceId, invoice]),
    )
    exportCsv(
      `sales-report-${from || 'all'}-to-${to || 'all'}.csv`,
      [
        'Invoice Number',
        'Sale Date and Time',
        'Customer',
        'Product Name',
        'SKU',
        'Quantity Sold',
        'Sale Price',
        'Line Total',
        'Payment Method',
        'Allocated Invoice Discount',
        'Line Total After Discount',
      ],
      filteredLines.map((line) => {
        const invoice = invoiceById.get(line.invoiceId)
        return [
          line.invoiceNumber,
          formatDateTime(line.saleDate),
          line.customerName || 'Walk-in customer',
          line.productName,
          line.sku,
          line.quantity,
          line.price,
          line.lineTotal,
          paymentLabel(line.paymentMethod),
          invoice?.discountShare ?? 0,
          invoice?.net ?? line.lineTotal,
        ]
      }),
    )
    toast.success('Sales report CSV exported.')
  }

  function handlePrint() {
    if (!filteredLines.length) {
      toast.info('There are no sales to print for this selection.')
      return
    }
    const rows = filteredLines
      .map(
        (line) => `<tr>
  <td>${escapeHtml(line.invoiceNumber)}</td>
  <td>${escapeHtml(formatDateTime(line.saleDate))}</td>
  <td>${escapeHtml(line.productName)}</td>
  <td>${escapeHtml(line.sku)}</td>
  <td class="num">${formatNumber(line.quantity)}</td>
  <td class="num">${escapeHtml(formatCurrency(line.price))}</td>
  <td class="num">${escapeHtml(formatCurrency(line.lineTotal))}</td>
  <td>${escapeHtml(paymentLabel(line.paymentMethod))}</td>
</tr>`,
      )
      .join('')

    const summaryRows = summaryDisplay
      .map(
        (row) => `<tr>
  <td>${escapeHtml(row.label)}</td>
  <td class="num">${row.invoices}</td>
  <td class="num">${formatNumber(row.units)}</td>
  <td class="num">${escapeHtml(formatCurrency(row.gross))}</td>
  <td class="num">${escapeHtml(formatCurrency(row.discount))}</td>
  <td class="num">${escapeHtml(formatCurrency(row.net))}</td>
</tr>`,
      )
      .join('')

    printDocument(
      'Sales Report',
      `<div class="doc-header">
  <div><h1>${escapeHtml(settings.ownerName || 'Grocery Store')}</h1><p>Sales Report</p></div>
  <div class="meta"><strong>${escapeHtml(formatDateKey(from))} – ${escapeHtml(formatDateKey(to))}</strong><p>${totals.invoices} invoices · ${filteredLines.length} lines</p></div>
</div>
<table>
  <thead><tr><th>Invoice</th><th>Date &amp; Time</th><th>Product</th><th>SKU</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th><th>Payment</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Line subtotal</span><strong>${escapeHtml(formatCurrency(totals.gross))}</strong></div>
  <div><span>Discounts</span><strong>− ${escapeHtml(formatCurrency(totals.discount))}</strong></div>
  <div class="grand"><span>Total sales value</span><span>${escapeHtml(formatCurrency(totals.net))}</span></div>
</div>
<h2 style="margin-top:26px;font-size:15px;color:#14532d;">${escapeHtml(grouping.charAt(0).toUpperCase() + grouping.slice(1))} summary</h2>
<table>
  <thead><tr><th>Period</th><th class="num">Invoices</th><th class="num">Units</th><th class="num">Gross</th><th class="num">Discount</th><th class="num">Net sales</th></tr></thead>
  <tbody>${summaryRows}</tbody>
</table>
<p class="note">Generated from saved LocalStorage sales invoices on ${escapeHtml(formatDateKey(today))}.</p>`,
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Sales Report"
        description="Invoice and product-level sales derived from saved transactions, with daily, weekly and monthly summaries."
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
        <StatCard label="Total sales value" value={formatCurrency(totals.net)} icon={TrendingUp} tone="green" />
        <StatCard label="Invoices" value={formatNumber(totals.invoices)} icon={Receipt} tone="brand" hint="Unique completed sales" />
        <StatCard label="Units sold" value={formatNumber(totals.units)} icon={BarChart3} tone="amber" hint="Across matching lines" />
        <StatCard label="Average bill" value={formatCurrency(totals.average)} icon={Users} tone="blue" hint="Net sales per invoice" />
      </div>

      <Card>
        <CardHeader
          title="Sales records"
          description={`${formatDateKey(from)} – ${formatDateKey(to)}`}
          action={<Badge tone="slate">{filteredLines.length} matching lines</Badge>}
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
          searchPlaceholder="Search invoice, customer, product, SKU or payment…"
        />

        {filteredLines.length ? (
          <>
            {summary.length > 1 ? (
              <div className="border-b border-slate-100 px-3 pt-1">
                <PeriodBarChart
                  data={summary.map((row) => ({ label: row.label, value: row.net }))}
                  name="Net sales"
                  color="#0f766e"
                />
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Sale Date &amp; Time</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-right">Quantity Sold</th>
                    <th className="px-4 py-3 text-right">Sale Price</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((line) => (
                    <tr key={line.rowId} className="text-xs transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-[11px] font-semibold text-slate-700">
                        {line.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(line.saleDate)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{line.productName}</p>
                        {line.customerName ? (
                          <p className="text-[10px] text-slate-400">{line.customerName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{line.sku}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatNumber(line.quantity)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(line.price)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(line.lineTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={line.paymentMethod === 'cash' ? 'green' : line.paymentMethod === 'upi' ? 'blue' : 'violet'}>
                          {paymentLabel(line.paymentMethod)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-500">
                <span>Line subtotal: <strong className="text-slate-700">{formatCurrency(totals.gross)}</strong></span>
                <span>Discounts: <strong className="text-slate-700">− {formatCurrency(totals.discount)}</strong></span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-slate-500">Total sales value</span>
                <span className="text-base font-bold text-slate-900">{formatCurrency(totals.net)}</span>
              </div>
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              totalItems={filteredLines.length}
              onPageChange={setPage}
              itemLabel="lines"
            />

            <div className="overflow-x-auto border-t border-slate-100">
              <div className="px-5 pb-1 pt-4">
                <h3 className="text-xs font-semibold text-slate-700">
                  {grouping === 'daily' ? 'Daily' : grouping === 'weekly' ? 'Weekly' : 'Monthly'} summary
                </h3>
              </div>
              <table className="w-full min-w-[780px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5">Period</th>
                    <th className="px-5 py-2.5 text-right">Invoices</th>
                    <th className="px-5 py-2.5 text-right">Units</th>
                    <th className="px-5 py-2.5 text-right">Gross</th>
                    <th className="px-5 py-2.5 text-right">Discount</th>
                    <th className="px-5 py-2.5 text-right">Net sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryDisplay.map((row) => (
                    <tr key={row.key} className="text-xs">
                      <td className="px-5 py-2.5 font-medium text-slate-700">{row.label}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{row.invoices}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{formatNumber(row.units)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{formatCurrency(row.gross)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600">{formatCurrency(row.discount)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-slate-800">
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Receipt}
            title="No sales records found"
            message="Change the date range or search term, or complete a new sale from the billing page."
          />
        )}
      </Card>
    </div>
  )
}
