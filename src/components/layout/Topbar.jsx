import { Bell, CalendarDays, Menu } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { formatDateKey } from '../../utils/dateUtils'

const TITLES = [
  { match: /^\/$/, title: 'Dashboard' },
  { match: /^\/products/, title: 'Product Management' },
  { match: /^\/purchase-entry/, title: 'Purchase Entry' },
  { match: /^\/sales-billing/, title: 'Sales & Billing' },
  { match: /^\/purchase-report/, title: 'Purchase Report' },
  { match: /^\/sales-report/, title: 'Sales Report' },
  { match: /^\/expiry-alerts/, title: 'Expiry Alerts' },
  { match: /^\/email-settings/, title: 'Email Settings' },
]

export default function Topbar({ onMenu, today, shopName, alertCount = 0 }) {
  const { pathname } = useLocation()
  const title = TITLES.find((item) => item.match.test(pathname))?.title || 'Grocery Manager'
  const initials = String(shopName || 'GS')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Grocery Manager
            </p>
            <h1 className="truncate text-sm font-semibold text-slate-900">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm sm:flex">
            <CalendarDays size={14} className="text-brand-600" />
            {formatDateKey(today)}
          </span>
          <Link
            to="/expiry-alerts"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-brand-700"
            aria-label={`Expiry alerts${alertCount ? `: ${alertCount} expiring soon` : ''}`}
          >
            <Bell size={17} />
            {alertCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            ) : null}
          </Link>
          <div className="hidden items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm md:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-bold text-brand-700">
              {initials || 'GS'}
            </span>
            <div className="max-w-[140px]">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Shop owner
              </p>
              <p className="truncate text-xs font-semibold text-slate-700">
                {shopName || 'Set shop name'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
