const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
}

const DOTS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  slate: 'bg-slate-400',
  brand: 'bg-brand-600',
  blue: 'bg-sky-500',
  violet: 'bg-violet-500',
}

export default function Badge({
  tone = 'slate',
  dot = false,
  className = '',
  children,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone] || TONES.slate} ${className}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone] || DOTS.slate}`} /> : null}
      {children}
    </span>
  )
}
