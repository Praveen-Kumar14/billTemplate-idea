import { getStockStatus, formatNumber } from '../../utils/calculations'
import Badge from './Badge'

export default function StockBadge({ currentStock, openingStock, showValue = true }) {
  const status = getStockStatus(currentStock, openingStock)
  return (
    <Badge tone={status.tone} dot>
      {showValue ? `${formatNumber(currentStock)} · ${status.label}` : status.label}
    </Badge>
  )
}
