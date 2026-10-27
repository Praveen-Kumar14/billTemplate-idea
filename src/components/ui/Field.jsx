const CONTROL =
  'w-full rounded-xl border bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

function stateClasses(invalid) {
  return invalid
    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
    : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'
}

export function Field({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  className = '',
  children,
}) {
  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600"
        >
          {label}
          {required ? <span className="text-red-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ invalid = false, className = '', ...props }) {
  return (
    <input
      className={`h-10.5 ${CONTROL} ${stateClasses(invalid)} ${className}`}
      {...props}
    />
  )
}

export function Select({ invalid = false, className = '', children, ...props }) {
  return (
    <select
      className={`h-10.5 ${CONTROL} ${stateClasses(invalid)} cursor-pointer pr-8 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ invalid = false, className = '', rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${CONTROL} py-2.5 ${stateClasses(invalid)} ${className}`}
      {...props}
    />
  )
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
        {...props}
      />
      <span>{label}</span>
    </label>
  )
}
