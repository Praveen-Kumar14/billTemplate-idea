export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #0f172a;
    font-size: 12px;
    line-height: 1.5;
  }
  h1, h2, h3, p { margin: 0; }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    border-bottom: 2px solid #14532d;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .doc-header h1 { font-size: 22px; color: #14532d; letter-spacing: -0.02em; }
  .doc-header p { color: #475569; margin-top: 2px; }
  .meta { text-align: right; color: #475569; }
  .meta strong { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th {
    background: #f0fdf4;
    color: #14532d;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid #bbf7d0;
  }
  td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 18px; margin-left: auto; width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand {
    border-top: 2px solid #14532d;
    margin-top: 4px;
    padding-top: 8px;
    font-size: 15px;
    font-weight: 700;
    color: #14532d;
  }
  .note { margin-top: 26px; color: #64748b; font-size: 10px; }
  .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 600; }
  .badge-red { background: #fee2e2; color: #b91c1c; }
  .badge-amber { background: #fef3c7; color: #b45309; }
  .badge-green { background: #dcfce7; color: #15803d; }
  @media print {
    body { padding: 0; }
    @page { margin: 14mm; }
  }
`

export function printDocument(title, bodyHtml) {
  const popup = window.open('', '_blank', 'width=960,height=760')
  if (!popup) {
    throw new Error('Allow pop-ups to print this document.')
  }

  popup.document.open()
  popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>${bodyHtml}</body>
</html>`)
  popup.document.close()

  popup.onload = () => {
    popup.focus()
    popup.print()
  }

  setTimeout(() => {
    if (!popup.closed) {
      popup.focus()
      popup.print()
    }
  }, 400)
}
