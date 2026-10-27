import {
  BarChart3,
  BellRing,
  ClipboardList,
  LayoutDashboard,
  Mail,
  Package,
  Receipt,
  ShoppingBasket,
  Store,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Product Management', icon: Package },
  { to: '/purchase-entry', label: 'Purchase Entry', icon: ShoppingBasket },
  { to: '/sales-billing', label: 'Sales / Billing', icon: Receipt },
  { to: '/purchase-report', label: 'Purchase Report', icon: ClipboardList },
  { to: '/sales-report', label: 'Sales Report', icon: BarChart3 },
  { to: '/expiry-alerts', label: 'Expiry Alerts', icon: BellRing },
  { to: '/email-settings', label: 'Email Settings', icon: Mail },
]

export default function Sidebar({
  open,
  onClose,
  shopName,
  expiringCount = 0,
  expiringTodayCount = 0,
  expiredCount = 0,
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-brand-900 text-white transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-200 ring-1 ring-white/10">
            <Store size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
              Grocery Manager
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {shopName || 'Your Grocery Store'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-100/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200/50">
            Workspace
          </p>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/10'
                          : 'text-emerald-100/75 hover:bg-white/[0.06] hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={17}
                          className={isActive ? 'text-emerald-300' : 'text-emerald-200/60'}
                        />
                        <span className="truncate">{item.label}</span>
                        {item.to === '/expiry-alerts' && expiringCount > 0 ? (
                          <span className="ml-auto rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                            {expiringCount}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3.5">
            <div className="flex items-center gap-2 text-amber-200">
              <BellRing size={15} />
              <p className="text-xs font-semibold">Expiry watch</p>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-emerald-100/65">
              {expiringCount > 0
                ? `${expiringCount} product${expiringCount === 1 ? '' : 's'} need attention within 5 days.`
                : 'No products are expiring in the next 5 days.'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-semibold">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-emerald-100/80">
                Today: {expiringTodayCount}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-emerald-100/80">
                Expired: {expiredCount}
              </span>
            </div>
            <NavLink
              to="/expiry-alerts"
              onClick={onClose}
              className="mt-3 inline-flex text-[11px] font-semibold text-emerald-300 transition hover:text-emerald-200"
            >
              Review alerts →
            </NavLink>
          </div>
          <p className="mt-3 px-1 text-[10px] text-emerald-100/40">
            Local-first billing · data stays in this browser
          </p>
        </div>
      </aside>
    </>
  )
}
