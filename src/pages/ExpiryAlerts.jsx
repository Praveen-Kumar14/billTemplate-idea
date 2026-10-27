import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  Clock3,
  Info,
  Mail,
  Send,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { getExpirySnapshot } from '../services/expiryService'
import { getEmailConfigStatus, sendExpiryAlert } from '../services/emailService'
import { formatDateKey, formatDateTime, formatDaysRemaining } from '../utils/dateUtils'
import { formatNumber, unitShort } from '../utils/calculations'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import PageHeader from '../components/ui/PageHeader'
import SearchInput from '../components/ui/SearchInput'
import StatCard from '../components/ui/StatCard'

const TABS = [
  { value: 'soon', label: 'Expiring Soon', icon: Clock3 },
  { value: 'today', label: 'Expiring Today', icon: CalendarClock },
  { value: 'expired', label: 'Expired Products', icon: AlertOctagon },
  { value: 'all', label: 'All Products with Expiry Dates', icon: CalendarRange },
  { value: 'history', label: 'Email Alert History', icon: Mail },
]

function statusTone(status) {
  if (status === 'success') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'skipped') return 'slate'
  return 'amber'
}

function EmptyForTab({ tab }) {
  const copy = {
    soon: {
      title: 'No products expiring in the next 5 days',
      message: 'Every stock batch is outside the 5-day alert window.',
    },
    today: {
      title: 'Nothing expires today',
      message: 'No sellable batches have an expiry date of today.',
    },
    expired: {
      title: 'No expired stock',
      message: 'No batches with remaining stock are past their expiry date.',
    },
    all: {
      title: 'No expiry-tracked products',
      message: 'Add products with expiry dates or record a purchase batch.',
    },
    history: {
      title: 'No email attempts yet',
      message: 'Manual, scheduled and test email attempts will be logged here.',
    },
  }
  const entry = copy[tab] || copy.soon
  return <EmptyState icon={ShieldCheck} title={entry.title} message={entry.message} />
}

function ExpiryTable({ entries, search, tab }) {
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return entries
    return entries.filter((entry) =>
      [entry.productName, entry.sku, entry.batchNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [entries, search])

  if (!filtered.length) {
    return <EmptyForTab tab={tab} />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Product Name</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3 text-right">Gram / Weight / Volume Value</th>
            <th className="px-4 py-3 text-right">Available Quantity</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Batch Number</th>
            <th className="px-4 py-3">Expiry Date</th>
            <th className="px-4 py-3">Days Remaining</th>
            <th className="px-4 py-3">Alert Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((entry) => (
            <tr
              key={`${entry.batchId || 'no-batch'}-${entry.productId}`}
              className={`text-xs transition hover:bg-slate-50/60 ${
                entry.status === 'expired' ? 'bg-red-50/30' : ''
              }`}
            >
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-800">{entry.productName}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{entry.category}</p>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-semibold text-slate-600">
                  {entry.sku}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {formatNumber(entry.packageWeight)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">
                {formatNumber(entry.quantity)}
              </td>
              <td className="px-4 py-3 text-slate-500">{unitShort(entry.unit)}</td>
              <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                {entry.batchNumber || '—'}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatDateKey(entry.expiryDate)}</td>
              <td
                className={`px-4 py-3 font-semibold ${
                  entry.status === 'expired'
                    ? 'text-red-600'
                    : entry.status === 'today'
                      ? 'text-red-600'
                      : entry.status === 'soon'
                        ? 'text-amber-600'
                        : 'text-slate-600'
                }`}
              >
                {formatDaysRemaining(entry.daysRemaining)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={entry.tone}>{entry.alertStatus}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmailHistoryTable({ history, search }) {
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return history
    return history.filter((entry) =>
      [entry.recipient, entry.type, entry.status, entry.message, entry.subject]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    )
  }, [history, search])

  if (!filtered.length) {
    return <EmptyForTab tab="history" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Sent At</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Recipient</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Products</th>
            <th className="px-4 py-3">Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((entry) => (
            <tr key={entry.id} className="text-xs transition hover:bg-slate-50/60">
              <td className="px-4 py-3 text-slate-500">{formatDateTime(entry.sentAt)}</td>
              <td className="px-4 py-3">
                <Badge tone={entry.type === 'scheduled' ? 'brand' : entry.type === 'manual' ? 'blue' : 'violet'}>
                  {entry.type}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-600">{entry.recipient}</td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(entry.status)} dot>
                  {entry.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {formatNumber(entry.productCount || 0)}
                {entry.expiredCount ? (
                  <span className="ml-1 text-[10px] text-red-500">
                    +{entry.expiredCount} expired
                  </span>
                ) : null}
              </td>
              <td className="max-w-[320px] px-4 py-3 text-slate-500">
                <p className="truncate" title={entry.message}>
                  {entry.message || '—'}
                </p>
                {entry.subject ? (
                  <p className="mt-0.5 truncate text-[10px] text-slate-400" title={entry.subject}>
                    {entry.subject}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ExpiryAlerts() {
  const { products, batches, settings, emailHistory, today } = useData()
  const toast = useToast()
  const [tab, setTab] = useState('soon')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const snapshot = useMemo(
    () => getExpirySnapshot(today, { products, batches }),
    [products, batches, today],
  )
  const emailStatus = useMemo(() => getEmailConfigStatus(settings), [settings])

  const tabEntries = {
    soon: snapshot.expiring,
    today: snapshot.expiringToday,
    expired: snapshot.expired,
    all: snapshot.all,
  }

  const tabCounts = {
    soon: snapshot.counts.expiringBatches,
    today: snapshot.counts.expiringTodayBatches,
    expired: snapshot.counts.expiredBatches,
    all: snapshot.counts.allBatches,
    history: emailHistory.length,
  }

  async function handleSend() {
    if (sending) return
    setSending(true)
    try {
      const result = await sendExpiryAlert({ settings, type: 'manual' })
      setLastResult(result)
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

  const activeTab = TABS.find((entry) => entry.value === tab) || TABS[0]
  const descriptions = {
    soon: 'Sellable batches with 0–5 calendar days remaining, including the fifth day.',
    today: 'Products with stock that expire today. Prioritize these for immediate action.',
    expired: 'Products past their expiry date. These are blocked from sales.',
    all: 'Every product and batch that has an expiry date recorded.',
    history: 'Every manual, scheduled and test email attempt with its delivery result.',
  }

  return (
    <div>
      <PageHeader
        eyebrow="Expiry control"
        title="Expiry Alerts"
        description="Expiry status is recalculated from local batches every time this page loads, receives focus, and before emails are sent."
        actions={
          <Button onClick={handleSend} loading={sending} disabled={sending}>
            <Send size={16} />
            Send Expiry Alert Email Now
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Expiring within 5 days"
          value={formatNumber(snapshot.counts.expiringProducts)}
          hint={`${formatNumber(snapshot.counts.expiringBatches)} batches included`}
          icon={Clock3}
          tone="amber"
        />
        <StatCard
          label="Expiring today"
          value={formatNumber(snapshot.counts.expiringTodayProducts)}
          hint="Take action immediately"
          icon={AlertTriangle}
          tone="red"
        />
        <StatCard
          label="Expired products"
          value={formatNumber(snapshot.counts.expiredProducts)}
          hint="Blocked from sellable stock"
          icon={AlertOctagon}
          tone="red"
        />
        <StatCard
          label="Owner email"
          value={emailStatus.configured ? 'Ready' : 'Not configured'}
          hint={settings.ownerEmail || 'Add an owner email in settings'}
          icon={Mail}
          tone={emailStatus.configured ? 'green' : 'slate'}
        />
      </div>

      {lastResult ? (
        <div
          className={`mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${
            lastResult.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : lastResult.status === 'skipped'
                ? 'border-slate-200 bg-slate-50 text-slate-600'
                : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span className="font-medium">{lastResult.message}</span>
          <span className="text-[10px] opacity-70">
            {lastResult.history?.sentAt ? formatDateTime(lastResult.history.sentAt) : ''}
          </span>
        </div>
      ) : null}

      {!emailStatus.configured ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Add {emailStatus.missing.join(', ')} to enable real email delivery.
          </span>
          <Link
            to="/email-settings"
            className="inline-flex items-center gap-1.5 font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            <Settings2 size={13} />
            Open Email Settings
          </Link>
        </div>
      ) : null}

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((entry) => {
          const Icon = entry.icon
          const active = tab === entry.value
          return (
            <button
              key={entry.value}
              type="button"
              onClick={() => setTab(entry.value)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                active
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={14} />
              {entry.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tabCounts[entry.value]}
              </span>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader
          title={activeTab.label}
          description={descriptions[tab]}
          action={
            <Badge tone={tab === 'expired' ? 'red' : tab === 'history' ? 'slate' : 'amber'}>
              {tabCounts[tab]} record{tabCounts[tab] === 1 ? '' : 's'}
            </Badge>
          }
        />
        <div className="border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              tab === 'history'
                ? 'Search recipient, type, status or message…'
                : 'Search product, SKU or batch…'
            }
            className="max-w-md"
          />
        </div>

        {tab === 'history' ? (
          <EmailHistoryTable history={emailHistory} search={search} />
        ) : (
          <ExpiryTable entries={tabEntries[tab] || []} search={search} tab={tab} />
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-[11px] leading-5 text-sky-800">
        <Info size={15} className="mt-0.5 shrink-0 text-sky-600" />
        <div>
          <p className="font-semibold text-sky-900">Automatic email scheduling</p>
          <p className="mt-0.5">
            The browser checks at 10:30 AM IST while this app is open and catches up when you reopen it.
            Reliable delivery when the browser is closed requires a server-side scheduler such as
            node-cron plus an email provider. See{' '}
            <Link to="/email-settings" className="font-semibold underline underline-offset-2">
              Email Settings
            </Link>{' '}
            for the recommended setup.
          </p>
        </div>
      </div>
    </div>
  )
}
