import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { getExpirySnapshot } from '../../services/expiryService'
import { useScheduler } from '../../hooks/useScheduler'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { products, batches, settings, today } = useData()
  const { pathname } = useLocation()
  useScheduler()

  const snapshot = getExpirySnapshot(today, { products, batches })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        shopName={settings.ownerName}
        expiringCount={snapshot.counts.expiringProducts}
        expiringTodayCount={snapshot.counts.expiringTodayProducts}
        expiredCount={snapshot.counts.expiredProducts}
      />
      <div className="lg:pl-72">
        <Topbar
          onMenu={() => setMenuOpen(true)}
          today={today}
          shopName={settings.ownerName}
          alertCount={snapshot.counts.expiringProducts}
        />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 text-center text-[11px] text-slate-400 sm:px-6 lg:px-8">
          Grocery Billing &amp; Expiry Alert Management · Local data stored in this browser
        </footer>
      </div>
    </div>
  )
}
