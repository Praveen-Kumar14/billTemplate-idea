import { getExpiryMeta } from '../../utils/dateUtils'
import Badge from './Badge'

export default function ExpiryBadge({ expiryDate, referenceDate, showLabel = true }) {
  const meta = getExpiryMeta(expiryDate, referenceDate)
  const label = !showLabel
    ? meta.shortLabel || meta.label
    : meta.status === 'safe'
      ? 'Safe'
      : meta.label

  return (
    <Badge tone={meta.tone} dot>
      {label}
    </Badge>
  )
}
