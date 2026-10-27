export function nextId(prefix, items, idField = 'id') {
  const max = (items || []).reduce((current, item) => {
    const match = String(item?.[idField] || '').match(/(\d+)$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

export function makeId(prefix) {
  const stamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${stamp}-${random}`
}
