import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { ToastContext } from '../../context/ToastContext'

const TONES = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-white',
    iconClass: 'text-emerald-600',
    barClass: 'bg-emerald-500',
  },
  error: {
    icon: AlertCircle,
    className: 'border-red-200 bg-white',
    iconClass: 'text-red-600',
    barClass: 'bg-red-500',
  },
  info: {
    icon: Info,
    className: 'border-slate-200 bg-white',
    iconClass: 'text-slate-500',
    barClass: 'bg-slate-400',
  },
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info') => {
      counter.current += 1
      const id = counter.current
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => remove(id), 4500)
    },
    [remove],
  )

  const value = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone] || TONES.info
          const Icon = tone.icon
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border p-3.5 shadow-lg shadow-slate-900/5 ${tone.className}`}
            >
              <div className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${tone.barClass}`} />
              <Icon size={18} className={`mt-0.5 shrink-0 ${tone.iconClass}`} />
              <p className="min-w-0 flex-1 text-sm leading-5 text-slate-700">{toast.message}</p>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
