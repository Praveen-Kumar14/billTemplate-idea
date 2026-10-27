import emailjs from '@emailjs/browser'
import { formatDateKey, formatDateTime, formatNotificationTime } from '../utils/dateUtils'
import {
  formatNumber,
  formatWeightValue,
  unitShort,
} from '../utils/calculations'
import { escapeHtml } from '../utils/print'
import { nextId } from '../utils/id'
import { appendEmailHistory, getEmailHistory } from './storageService'
import { getEmailSnapshot } from './expiryService'

export const EXPIRY_EMAIL_SUBJECT =
  'Grocery Expiry Alert – Products Expiring Within 5 Days'

function envValue(key) {
  const value = import.meta.env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveEmailConfig(settings) {
  const serviceId = String(settings?.emailJsServiceId || '').trim() || envValue('VITE_EMAILJS_SERVICE_ID')
  const templateId =
    String(settings?.emailJsTemplateId || '').trim() || envValue('VITE_EMAILJS_TEMPLATE_ID')
  const publicKey =
    String(settings?.emailJsPublicKey || '').trim() || envValue('VITE_EMAILJS_PUBLIC_KEY')

  return {
    serviceId,
    templateId,
    publicKey,
    ownerEmail: String(settings?.ownerEmail || '').trim(),
    serviceFromEnv: !String(settings?.emailJsServiceId || '').trim() && Boolean(envValue('VITE_EMAILJS_SERVICE_ID')),
    templateFromEnv: !String(settings?.emailJsTemplateId || '').trim() && Boolean(envValue('VITE_EMAILJS_TEMPLATE_ID')),
    publicKeyFromEnv: !String(settings?.emailJsPublicKey || '').trim() && Boolean(envValue('VITE_EMAILJS_PUBLIC_KEY')),
  }
}

export function getEmailConfigStatus(settings) {
  const config = resolveEmailConfig(settings)
  const missing = []
  if (!config.ownerEmail) missing.push('owner email')
  if (!config.serviceId) missing.push('service ID')
  if (!config.templateId) missing.push('template ID')
  if (!config.publicKey) missing.push('public key')
  return {
    ...config,
    configured: missing.length === 0,
    missing,
  }
}

function daysText(days) {
  if (days === null || days === undefined) return '—'
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Today'
  return `${days} day${days === 1 ? '' : 's'}`
}

function statusTone(days) {
  if (days <= 0) return { bg: '#fee2e2', color: '#b91c1c' }
  return { bg: '#fef3c7', color: '#b45309' }
}

function buildProductRows(products, includeStatus = true) {
  return products
    .map((product) => {
      const tone = statusTone(product.daysRemaining)
      return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(product.productName)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">${escapeHtml(product.sku)}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">${escapeHtml(formatWeightValue(product.packageWeight, product.unit))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#475569;">${formatNumber(product.quantity)} ${escapeHtml(unitShort(product.unit))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;color:#475569;white-space:nowrap;">${escapeHtml(formatDateKey(product.expiryDate))}</td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:12px;white-space:nowrap;">
    ${
      includeStatus
        ? `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${tone.bg};color:${tone.color};font-size:11px;font-weight:700;">${escapeHtml(daysText(product.daysRemaining))}</span>`
        : escapeHtml(daysText(product.daysRemaining))
    }
  </td>
</tr>`
    })
    .join('')
}

function productTable(products, includeStatus = true) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0 4px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
  <thead>
    <tr style="background:#f0fdf4;">
      <th align="left" style="padding:9px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d;border-bottom:1px solid #bbf7d0;">Product Name</th>
      <th align="left" style="padding:9px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d;border-bottom:1px solid #bbf7d0;">SKU</th>
      <th align="left" style="padding:9px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d;border-bottom:1px solid #bbf7d0;">Weight / Gram Value</th>
      <th align="left" style="padding:9px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d;border-bottom:1px solid #bbf7d0;">Available Quantity</th>
      <th align="left" style="padding:9px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d;border-bottom:1px solid #bbf7d0;">Expiry Date</th>
      <th align="left" style="padding:9px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;color:#14532d;border-bottom:1px solid #bbf7d0;">Days Remaining</th>
    </tr>
  </thead>
  <tbody>${buildProductRows(products, includeStatus)}</tbody>
</table>`
}

export function buildExpiryEmail({
  expiringProducts,
  expiredProducts = [],
  includeExpired = false,
  shopName = '',
  ownerName = '',
  generatedAt = new Date(),
}) {
  const expiring = expiringProducts || []
  const expired = includeExpired ? expiredProducts || [] : []
  const expiringToday = expiring.filter((product) => product.daysRemaining === 0)
  const displayShop = shopName || 'Grocery Store'
  const displayOwner = ownerName || 'Shop Owner'
  const generatedLabel = formatDateTime(generatedAt)
  const subject = EXPIRY_EMAIL_SUBJECT

  const intro =
    'The following grocery products are expiring within the next five days. Please review the quantities and take the necessary action.'

  const totals = [
    `Total products expiring within 5 days: ${expiring.length}`,
    `Total products expiring today: ${expiringToday.length}`,
    ...(includeExpired
      ? [`Total already-expired products: ${expired.length}`]
      : []),
    `Alert generated: ${generatedLabel} IST`,
  ]

  const textLines = [
    `Dear ${displayOwner},`,
    '',
    intro,
    '',
    'Product Name | SKU | Weight / Gram Value | Available Quantity | Expiry Date | Days Remaining',
    ...expiring.map(
      (product) =>
        `${product.productName} | ${product.sku} | ${formatWeightValue(product.packageWeight, product.unit)} | ${formatNumber(product.quantity)} ${unitShort(product.unit)} | ${formatDateKey(product.expiryDate)} | ${daysText(product.daysRemaining)}`,
    ),
    '',
    ...totals,
  ]

  if (includeExpired && expired.length) {
    textLines.push('', 'Expired products requiring immediate attention:', '')
    expired.forEach((product) => {
      textLines.push(
        `${product.productName} | ${product.sku} | ${formatWeightValue(product.packageWeight, product.unit)} | ${formatNumber(product.quantity)} ${unitShort(product.unit)} | ${formatDateKey(product.expiryDate)} | ${daysText(product.daysRemaining)}`,
      )
    })
  }

  textLines.push('', `${displayShop}`, 'Automated grocery expiry alert.')

  const todayBanner = expiringToday.length
    ? `<div style="margin:16px 0;padding:12px 14px;border:1px solid #fecaca;background:#fef2f2;border-radius:10px;font-family:Arial,sans-serif;font-size:13px;color:#991b1b;">
        <strong>${expiringToday.length} product${expiringToday.length === 1 ? '' : 's'} expire today.</strong> Please remove or discount these items immediately.
      </div>`
    : ''

  const expiredSection =
    includeExpired && expired.length
      ? `<div style="margin-top:26px;">
          <h2 style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:16px;color:#991b1b;">Expired Products</h2>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;">These products are past their expiry date. Remove them from sellable stock.</p>
          ${productTable(expired)}
        </div>`
      : ''

  const html = `<div style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="background:#14532d;padding:26px 30px;color:#ffffff;">
      <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#bbf7d0;font-weight:700;">Grocery Expiry Alert</div>
      <h1 style="margin:8px 0 6px;font-size:24px;line-height:1.25;font-weight:700;">Products expiring within 5 days</h1>
      <div style="font-size:12px;color:#dcfce7;">${escapeHtml(displayShop)} &middot; ${escapeHtml(generatedLabel)} IST</div>
    </div>
    <div style="padding:26px 30px 30px;">
      <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:14px;color:#0f172a;">Dear ${escapeHtml(displayOwner)},</p>
      <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#475569;">${intro}</p>
      ${todayBanner}
      ${productTable(expiring)}
      <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;">Available quantities are aggregated across qualifying batches. Stock is shown for each product at its earliest qualifying expiry date.</p>
      ${expiredSection}
      <div style="margin-top:24px;padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#14532d;font-weight:700;margin-bottom:8px;">Alert summary</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:3px 0;font-family:Arial,sans-serif;font-size:13px;color:#475569;">Total products expiring within 5 days</td><td align="right" style="padding:3px 0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#0f172a;">${expiring.length}</td></tr>
          <tr><td style="padding:3px 0;font-family:Arial,sans-serif;font-size:13px;color:#475569;">Total products expiring today</td><td align="right" style="padding:3px 0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#b91c1c;">${expiringToday.length}</td></tr>
          ${
            includeExpired
              ? `<tr><td style="padding:3px 0;font-family:Arial,sans-serif;font-size:13px;color:#475569;">Total already-expired products</td><td align="right" style="padding:3px 0;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#b91c1c;">${expired.length}</td></tr>`
              : ''
          }
          <tr><td style="padding:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;">Alert generated</td><td align="right" style="padding:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;">${escapeHtml(generatedLabel)} IST</td></tr>
        </table>
      </div>
      <p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#64748b;line-height:1.6;">This is an automated alert from ${escapeHtml(displayShop)}. Please verify stock physically before making pricing or disposal decisions.</p>
    </div>
    <div style="padding:14px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;">Grocery Billing &amp; Expiry Alert Management &middot; Notification time ${escapeHtml(formatNotificationTime('10:30'))} IST</div>
  </div>
</div>`

  return {
    subject,
    text: textLines.join('\n'),
    html,
    counts: {
      expiring: expiring.length,
      expiringToday: expiringToday.length,
      expired: includeExpired ? expired.length : 0,
    },
  }
}

export function logEmailAttempt({
  type,
  recipient,
  status,
  productCount = 0,
  expiredCount = 0,
  message = '',
  subject = '',
}) {
  const entry = {
    id: nextId('EMAIL', getEmailHistory()),
    type,
    recipient: recipient || 'Not configured',
    sentAt: new Date().toISOString(),
    status,
    productCount,
    expiredCount,
    subject,
    message,
  }
  appendEmailHistory(entry)
  return entry
}

function templateParams({
  settings,
  ownerName,
  shopName,
  subject,
  text,
  html,
  productTableHtml,
  counts,
  generatedAt,
}) {
  return {
    to_email: String(settings.ownerEmail || '').trim(),
    to_name: ownerName || 'Shop Owner',
    owner_name: ownerName || 'Shop Owner',
    owner_email: String(settings.ownerEmail || '').trim(),
    shop_name: shopName || 'Grocery Store',
    subject,
    email_subject: subject,
    title: subject,
    message: text,
    email_body: text,
    html_body: html,
    email_html: html,
    products_table: productTableHtml || '',
    products_table_html: productTableHtml || '',
    expiring_count: counts.expiring,
    expiring_today_count: counts.expiringToday,
    expired_count: counts.expired,
    generated_at: formatDateTime(generatedAt),
    alert_date: formatDateTime(generatedAt),
  }
}

export async function sendExpiryAlert({
  settings,
  type = 'manual',
  includeExpired = settings?.includeExpiredInEmail,
}) {
  const snapshot = getEmailSnapshot()
  const expiringProducts = snapshot.expiringProducts
  const expiredProducts = snapshot.expiredProducts
  const generatedAt = new Date()
  const config = getEmailConfigStatus(settings)

  if (!expiringProducts.length) {
    const message = 'No products are expiring within the next 5 days.'
    const history = logEmailAttempt({
      type,
      recipient: settings?.ownerEmail,
      status: 'skipped',
      productCount: 0,
      expiredCount: 0,
      message,
    })
    return { status: 'skipped', message, history }
  }

  if (!config.configured) {
    const message = `Email is not configured. Add ${config.missing.join(', ')} in Email Settings.`
    const history = logEmailAttempt({
      type,
      recipient: settings?.ownerEmail,
      status: 'failed',
      productCount: expiringProducts.length,
      expiredCount: includeExpired ? expiredProducts.length : 0,
      message,
      subject: EXPIRY_EMAIL_SUBJECT,
    })
    return { status: 'failed', message, history }
  }

  const email = buildExpiryEmail({
    expiringProducts,
    expiredProducts,
    includeExpired,
    shopName: settings.ownerName,
    ownerName: settings.ownerName,
    generatedAt,
  })

  const params = templateParams({
    settings,
    ownerName: settings.ownerName,
    shopName: settings.ownerName,
    subject: email.subject,
    text: email.text,
    html: email.html,
    counts: email.counts,
    generatedAt,
  })

  try {
    await emailjs.send(config.serviceId, config.templateId, params, {
      publicKey: config.publicKey,
    })
    const history = logEmailAttempt({
      type,
      recipient: config.ownerEmail,
      status: 'success',
      productCount: email.counts.expiring,
      expiredCount: email.counts.expired,
      message: `Expiry alert sent for ${email.counts.expiring} product${email.counts.expiring === 1 ? '' : 's'}.`,
      subject: email.subject,
    })
    return {
      status: 'success',
      message: history.message,
      history,
      productCount: email.counts.expiring,
      expiredCount: email.counts.expired,
    }
  } catch (error) {
    const message =
      error?.text || error?.message || 'EmailJS could not deliver the email. Please check your settings.'
    const history = logEmailAttempt({
      type,
      recipient: config.ownerEmail,
      status: 'failed',
      productCount: email.counts.expiring,
      expiredCount: email.counts.expired,
      message,
      subject: email.subject,
    })
    return { status: 'failed', message, history }
  }
}

export async function sendTestEmail(settings) {
  const config = getEmailConfigStatus(settings)
  if (!config.configured) {
    const message = `Email is not configured. Add ${config.missing.join(', ')} in Email Settings.`
    const history = logEmailAttempt({
      type: 'test',
      recipient: settings?.ownerEmail,
      status: 'failed',
      message,
      subject: 'Grocery Expiry Alert – Test Email',
    })
    return { status: 'failed', message, history }
  }

  const now = new Date()
  const subject = 'Grocery Expiry Alert – Test Email'
  const shopName = settings.ownerName || 'Grocery Store'
  const snapshot = getEmailSnapshot()
  const text = [
    `Dear ${settings.ownerName || 'Shop Owner'},`,
    '',
    'This is a test email from your Grocery Billing & Expiry Alert application.',
    `Email delivery is configured correctly for ${settings.ownerEmail}.`,
    '',
    `Products expiring within 5 days right now: ${snapshot.counts.expiringProducts}`,
    `Test generated: ${formatDateTime(now)} IST`,
    '',
    shopName,
  ].join('\n')

  const html = `<div style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="background:#14532d;padding:24px 28px;color:#ffffff;">
      <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#bbf7d0;font-weight:700;">Email Configuration Test</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Email delivery is working</h1>
    </div>
    <div style="padding:26px 28px;">
      <p style="margin:0 0 12px;font-size:14px;color:#0f172a;">Dear ${escapeHtml(settings.ownerName || 'Shop Owner')},</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569;">This is a test email from your Grocery Billing &amp; Expiry Alert application. EmailJS delivered this message to <strong>${escapeHtml(settings.ownerEmail)}</strong>.</p>
      <div style="padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:13px;color:#166534;">Products expiring within 5 days right now: <strong>${snapshot.counts.expiringProducts}</strong></div>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b;">Test generated ${escapeHtml(formatDateTime(now))} IST</p>
    </div>
  </div>
</div>`

  try {
    await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams({
        settings,
        ownerName: settings.ownerName,
        shopName,
        subject,
        text,
        html,
        counts: {
          expiring: snapshot.counts.expiringProducts,
          expiringToday: snapshot.counts.expiringTodayProducts,
          expired: snapshot.counts.expiredProducts,
        },
        generatedAt: now,
      }),
      { publicKey: config.publicKey },
    )
    const history = logEmailAttempt({
      type: 'test',
      recipient: config.ownerEmail,
      status: 'success',
      message: 'Test email delivered successfully.',
      subject,
    })
    return { status: 'success', message: 'Test email sent successfully.', history }
  } catch (error) {
    const message =
      error?.text || error?.message || 'EmailJS could not send the test email.'
    const history = logEmailAttempt({
      type: 'test',
      recipient: config.ownerEmail,
      status: 'failed',
      message,
      subject,
    })
    return { status: 'failed', message, history }
  }
}
