import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayKey } from '../utils/dateUtils'
import { STORAGE_EVENT } from '../utils/constants'
import {
  getBatches,
  getEmailHistory,
  getProducts,
  getPurchases,
  getSales,
  getSettings,
} from '../services/storageService'
import { DataContext } from './DataContext'

function loadAll() {
  return {
    products: getProducts(),
    batches: getBatches(),
    purchases: getPurchases(),
    sales: getSales(),
    settings: getSettings(),
    emailHistory: getEmailHistory(),
    today: todayKey(),
  }
}

export default function DataProvider({ children }) {
  const [data, setData] = useState(loadAll)

  const refresh = useCallback(() => {
    setData(loadAll())
  }, [])

  useEffect(() => {
    const handleChange = () => refresh()
    const handleFocus = () => refresh()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    window.addEventListener(STORAGE_EVENT, handleChange)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    const tick = window.setInterval(() => {
      const currentDay = todayKey()
      setData((previous) =>
        previous.today === currentDay ? previous : { ...previous, today: currentDay },
      )
    }, 60000)

    return () => {
      window.removeEventListener(STORAGE_EVENT, handleChange)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(tick)
    }
  }, [refresh])

  const value = useMemo(() => ({ ...data, refresh }), [data, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
