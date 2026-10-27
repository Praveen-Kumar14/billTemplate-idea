import { useEffect } from 'react'
import { checkScheduledAlert } from '../services/schedulerService'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

export function useScheduler() {
  const { refresh } = useData()
  const toast = useToast()

  useEffect(() => {
    let cancelled = false

    async function runCheck() {
      try {
        const outcome = await checkScheduledAlert()
        if (cancelled || !outcome.ran) return
        refresh()
        if (outcome.result?.status === 'success') {
          toast.success(
            `Scheduled expiry alert sent for ${outcome.result.productCount} product${outcome.result.productCount === 1 ? '' : 's'}.`,
          )
        } else if (outcome.result?.status === 'failed') {
          toast.error(`Scheduled alert failed: ${outcome.result.message}`)
        } else if (outcome.result?.status === 'skipped') {
          toast.info(outcome.result.message)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Scheduled expiry check failed.', error)
        }
      }
    }

    runCheck()
    const interval = window.setInterval(runCheck, 30000)

    const handleFocus = () => runCheck()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runCheck()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [refresh, toast])
}
