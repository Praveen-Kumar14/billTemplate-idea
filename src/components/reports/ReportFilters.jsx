import { CalendarRange, RotateCcw } from 'lucide-react'
import Button from '../ui/Button'
import { Input } from '../ui/Field'
import SearchInput from '../ui/SearchInput'
import { REPORT_GROUPINGS } from '../../utils/constants'

export default function ReportFilters({
  search,
  onSearch,
  from,
  to,
  onFrom,
  onTo,
  grouping,
  onGrouping,
  onReset,
  searchPlaceholder = 'Search…',
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder={searchPlaceholder}
          className="lg:max-w-sm lg:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <div>
            <label htmlFor="report-from" className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
              <CalendarRange size={11} />
              From
            </label>
            <Input id="report-from" type="date" value={from} onChange={(event) => onFrom(event.target.value)} className="sm:w-40" />
          </div>
          <div>
            <label htmlFor="report-to" className="mb-1 block text-[10px] font-semibold text-slate-500">
              To
            </label>
            <Input id="report-to" type="date" value={to} onChange={(event) => onTo(event.target.value)} className="sm:w-40" />
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="self-start sm:self-auto">
          <RotateCcw size={14} />
          Reset
        </Button>
      </div>
      {onGrouping ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Summarize by</span>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {REPORT_GROUPINGS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onGrouping(option.value)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                  grouping === option.value
                    ? 'bg-white text-brand-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
