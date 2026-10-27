import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Boxes,
  CheckCircle2,
  Clock,
  Mail,
  Package,
  Receipt,
  Send,
  ShoppingBasket,
  Sparkles,
  Store,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import {
  addDaysToKey,
  formatDateKey,
  formatDateTime,
  getExpiryMeta,
} from '../utils/dateUtils'
import {
  formatCurrency,
  formatNumber,
  formatWeightValue,
  unitShort,
} from '../utils/calculations'
import { getExpirySnapshot } from '../services/expiryService'
import { groupPurchasesByInvoice } from '../services/purchaseService'
import { getSchedulerStatus } from '../services/schedulerService'
import { getEmailConfigStatus, sendExpiryAlert } from '../services/emailService'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'

function compactCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0)
}

export default function Dashboard() {
  const { products, batches, purchases, sales, settings, today } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)

  const snapshot = useMemo(
    () => getExpirySnapshot(today, { products, batches }),
    [products, batches, today],
  )
  const scheduler = useMemo(() => getSchedulerStatus(settings), [settings])
  const emailStatus = useMemo(() => getEmailConfigStatus(settings), [settings])

  const todaysPurchases = purchases
    .filter((purchase) => purchase.purchaseDate === today)
    .reduce((total, purchase) => total + Number(purchase.lineTotal || 0), 0)
  const todaysSales = sales
    .filter((invoice) => invoice.dateKey === today)
    .reduce((total, invoice) => total + Number(invoice.grandTotal || 0), 0)
  const totalStock = products.reduce(
    (total, product) => total + Number(product.currentStock || 0),
    0,
  )

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const dateKey = addDaysToKey(today, index - 6)
      const salesValue = sales
        .filter((invoice) => invoice.dateKey === dateKey)
        .reduce((total, invoice) => total + Number(invoice.grandTotal || 0), 0)
      const purchaseValue = purchases
        .filter((purchase) => purchase.purchaseDate === dateKey)
        .reduce((total, purchase) => total + Number(purchase.lineTotal || 0), 0)
      return {
        dateKey,
        label: formatDateKey(dateKey, { year: undefined, weekday: 'short' }),
        Sales: salesValue,
        Purchases: purchaseValue,
      }
    })
  }, [purchases, sales, today])

  const recentTransactions = useMemo(() => {
    const purchaseInvoices = groupPurchasesByInvoice(purchases).map((invoice) => ({
      id: `purchase-${invoice.invoiceNumber}`,
      type: 'purchase',
      invoiceNumber: invoice.invoiceNumber,
      party: invoice.supplierName,
      amount: invoice.total,
      timestamp: invoice.createdAt,
      dateLabel: formatDateKey(invoice.purchaseDate),
    }))
    const saleInvoices = sales.map((invoice) => ({
      id: `sale-${invoice.id}`,
      type: 'sale',
      invoiceNumber: invoice.invoiceNumber,
      party: invoice.customerName || 'Walk-in customer',
      amount: invoice.grandTotal,
      timestamp: invoice.saleDate,
      dateLabel: formatDateTime(invoice.saleDate),
    }))
    return [...purchaseInvoices, ...saleInvoices]
      .sort(
        (a, b) =>
          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
      )
      .slice(0, 6)
  }, [purchases, sales])

  const expiringPreview = snapshot.expiring.slice(0, 5)

  async function handleSendAlert() {
    if (sending) return
    setSending(true)
    try {
      const result = await sendExpiryAlert({ settings, type: 'manual' })
      if (result.status === 'success') {
        toast.success(result.message)
      } else if (result.status === 'skipped') {
        toast.info(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(error?.message || 'Could not send the expiry alert.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={formatDateKey(today, { weekday: 'long' })}
        title="Dashboard"
        description={`A quick view of stock, billing and expiry risk at ${settings.ownerName || 'your store'}.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/email-settings')}>
              <Mail size={16} />
              Email settings
            </Button>
            <Button onClick={handleSendAlert} loading={sending} disabled={sending}>
              <Send size={16} />
              Send Expiry Alert Email Now
            </Button>
          </>
        }
      />

      {snapshot.counts.expiringProducts > 0 || snapshot.counts.expiredProducts > 0 ? (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <BellRing size={17} />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {snapshot.counts.expiringProducts > 0
                  ? `${snapshot.counts.expiringProducts} product${snapshot.counts.expiringProducts === 1 ? '' : 's'} expiring within 5 days`
                  : 'Expired stock needs attention'}
                {snapshot.counts.expiredProducts > 0
                  ? ` · ${snapshot.counts.expiredProducts} already expired`
                  : ''}
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80">
                {snapshot.counts.expiringTodayProducts > 0
                  ? `${snapshot.counts.expiringTodayProducts} product${snapshot.counts.expiringTodayProducts === 1 ? '' : 's'} expire today. `
                  : ''}
                Review quantities and take action before value is lost.
              </p>
            </div>
          </div>
          <Link
            to="/expiry-alerts"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Review expiry alerts
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">No expiry risk in the next 5 days</p>
            <p className="mt-0.5 text-xs text-emerald-800/80">
              All tracked batches are safely beyond the alert window.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Products"
          value={formatNumber(products.length)}
          hint="Active product catalogue"
          icon={Package}
          tone="brand"
        />
        <StatCard
          label="Total Stock Quantity"
          value={formatNumber(totalStock)}
          hint="All units on hand"
          icon={Boxes}
          tone="blue"
        />
        <StatCard
          label="Today's Purchases"
          value={formatCurrency(todaysPurchases)}
          hint={`${purchases.filter((purchase) => purchase.purchaseDate === today).length} purchase lines`}
          icon={ShoppingBasket}
          tone="slate"
        />
        <StatCard
          label="Today's Sales"
          value={formatCurrency(todaysSales)}
          hint={`${sales.filter((invoice) => invoice.dateKey === today).length} invoices`}
          icon={Receipt}
          tone="green"
        />
        <StatCard
          label="Expiring Within 5 Days"
          value={formatNumber(snapshot.counts.expiringProducts)}
          hint={`${snapshot.counts.expiringBatches} batch${snapshot.counts.expiringBatches === 1 ? '' : 'es'} included`}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Already Expired"
          value={formatNumber(snapshot.counts.expiredProducts)}
          hint="Remove from sellable stock"
          icon={AlertTriangle}
          tone="red"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Sales & purchases — last 7 days"
            description="Values are calculated from saved invoices and purchase lines."
            action={
              <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-600" /> Sales
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Purchases
                </span>
              </div>
            }
          />
          <div className="h-[264px] w-full px-2 pb-3 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                  tickFormatter={compactCurrency}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                    fontSize: 12,
                  }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ display: 'none' }} />
                <Bar dataKey="Sales" fill="#15803d" radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Purchases" fill="#fbbf24" radius={[5, 5, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Expiry alert summary"
            description="Batches with 0–5 days remaining"
            action={
              <Link
                to="/expiry-alerts"
                className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
              >
                View all
              </Link>
            }
          />
          {expiringPreview.length ? (
            <div className="divide-y divide-slate-100">
              {expiringPreview.map((entry) => {
                const meta = getExpiryMeta(entry.expiryDate, today)
                return (
                  <div key={entry.batchId} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {entry.productName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {entry.sku} · {formatWeightValue(entry.packageWeight, entry.unit)} ·{' '}
                        {formatNumber(entry.quantity)} {unitShort(entry.unit)}
                      </p>
                    </div>
                    <Badge tone={meta.tone} dot>
                      {meta.days === 0 ? 'Today' : `${meta.days}d`}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Nothing expiring soon"
              message="No batches fall inside the 5-day alert window."
              className="py-10"
            />
          )}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link
              to="/expiry-alerts"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              Open expiry management
              <ArrowRight size={13} />
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent transactions"
            description="Latest purchases and sales recorded in this browser"
            action={
              <div className="flex gap-3">
                <Link
                  to="/purchase-report"
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  Purchases
                </Link>
                <Link
                  to="/sales-report"
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  Sales
                </Link>
              </div>
            }
          />
          {recentTransactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5">Type</th>
                    <th className="px-5 py-2.5">Invoice</th>
                    <th className="px-5 py-2.5">Party</th>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="text-xs">
                      <td className="px-5 py-3">
                        <Badge tone={transaction.type === 'sale' ? 'green' : 'blue'}>
                          {transaction.type === 'sale' ? 'Sale' : 'Purchase'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {transaction.invoiceNumber}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{transaction.party}</td>
                      <td className="px-5 py-3 text-slate-500">{transaction.dateLabel}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              message="Purchases and sales will appear here as soon as you record them."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Email & scheduler"
            description="Daily 10:30 AM IST expiry check"
            action={
              <Badge tone={scheduler.enabled ? 'green' : 'slate'} dot>
                {scheduler.enabled ? 'Enabled' : 'Paused'}
              </Badge>
            }
          />
          <div className="space-y-3 px-5 py-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Clock size={14} className="text-brand-600" />
                Next scheduled check
              </div>
              <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
                {scheduler.nextRunLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {scheduler.lastScheduledAlertDate
                  ? `Last successful scheduled alert: ${formatDateKey(scheduler.lastScheduledAlertDate)}`
                  : 'No scheduled alert sent yet'}
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Owner email</p>
                <p className="mt-0.5 max-w-[190px] truncate text-xs font-medium text-slate-800">
                  {settings.ownerEmail || 'Not configured'}
                </p>
              </div>
              <Badge tone={emailStatus.configured ? 'green' : 'amber'}>
                {emailStatus.configured ? 'Ready' : 'Setup needed'}
              </Badge>
            </div>

            {scheduler.lastScheduledResult ? (
              <div className="rounded-xl border border-slate-200 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      scheduler.lastScheduledResult.status === 'success'
                        ? 'green'
                        : scheduler.lastScheduledResult.status === 'skipped'
                          ? 'slate'
                          : 'red'
                    }
                  >
                    {scheduler.lastScheduledResult.status}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(scheduler.lastScheduledResult.at)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">
                  {scheduler.lastScheduledResult.message}
                </p>
              </div>
            ) : null}

            <Button className="w-full" onClick={handleSendAlert} loading={sending} disabled={sending}>
              <Send size={15} />
              Send alert now
            </Button>
            <Link
              to="/email-settings"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Store size={14} />
              Configure email settings
            </Link>

            <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-[11px] leading-5 text-amber-800">
              Browser scheduling only runs while this page is open. For guaranteed 10:30 AM
              delivery, connect a server-side scheduler. See Email Settings for details.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
