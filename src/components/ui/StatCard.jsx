const TONES = {
  brand: {
    icon: 'bg-brand-50 text-brand-700',
    value: 'text-slate-900',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-700',
    value: 'text-emerald-700',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-700',
  },
  red: {
    icon: 'bg-red-50 text-red-600',
    value: 'text-red-700',
  },
  blue: {
    icon: 'bg-sky-50 text-sky-600',
    value: 'text-sky-700',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-600',
    value: 'text-slate-900',
  },
}

export default function StatCard({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const styles = TONES[tone] || TONES.brand
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.02] transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className={`mt-2 text-[22px] font-bold leading-none tracking-tight ${styles.value}`}>
            {value}
          </p>
          {hint ? <p className="mt-2 text-[11px] text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
          >
            <Icon size={17} />
          </span>
        ) : null}
      </div>
    </div>
  )
}
