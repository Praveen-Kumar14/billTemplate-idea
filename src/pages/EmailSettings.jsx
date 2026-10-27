import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Clock3,
  ExternalLink,
  History,
  Info,
  Mail,
  Save,
  Send,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { saveSettings } from '../services/storageService'
import {
  getEmailConfigStatus,
  resolveEmailConfig,
  sendTestEmail,
} from '../services/emailService'
import { getSchedulerStatus } from '../services/schedulerService'
import { formatDateTime, formatNotificationTime } from '../utils/dateUtils'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card, { CardHeader } from '../components/ui/Card'
import { Checkbox, Field, Input } from '../components/ui/Field'
import PageHeader from '../components/ui/PageHeader'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function statusTone(status) {
  if (status === 'success') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'skipped') return 'slate'
  return 'amber'
}

function formFromSettings(settings) {
  return {
    ownerName: settings.ownerName || '',
    ownerEmail: settings.ownerEmail || '',
    emailJsServiceId: settings.emailJsServiceId || '',
    emailJsTemplateId: settings.emailJsTemplateId || '',
    emailJsPublicKey: settings.emailJsPublicKey || '',
    notificationTime: settings.notificationTime || '10:30',
    notificationsEnabled: settings.notificationsEnabled !== false,
    includeExpiredInEmail: Boolean(settings.includeExpiredInEmail),
  }
}

export default function EmailSettings() {
  const { settings, emailHistory, refresh } = useData()
  const toast = useToast()

  const [form, setForm] = useState(() => formFromSettings(settings))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [lastTest, setLastTest] = useState(null)

  const candidate = useMemo(
    () => ({
      ...settings,
      ...form,
      ownerName: form.ownerName.trim(),
      ownerEmail: form.ownerEmail.trim(),
      emailJsServiceId: form.emailJsServiceId.trim(),
      emailJsTemplateId: form.emailJsTemplateId.trim(),
      emailJsPublicKey: form.emailJsPublicKey.trim(),
    }),
    [settings, form],
  )

  const emailStatus = useMemo(() => getEmailConfigStatus(candidate), [candidate])
  const config = useMemo(() => resolveEmailConfig(candidate), [candidate])
  const scheduler = useMemo(() => getSchedulerStatus(settings), [settings])
  const recentHistory = emailHistory.slice(0, 6)

  const dirty = useMemo(() => {
    const keys = [
      'ownerName',
      'ownerEmail',
      'emailJsServiceId',
      'emailJsTemplateId',
      'emailJsPublicKey',
      'notificationTime',
      'notificationsEnabled',
      'includeExpiredInEmail',
    ]
    return keys.some((key) => String(form[key]) !== String(settings[key] ?? ''))
  }, [form, settings])

  function update(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function validate() {
    const next = {}
    if (!form.ownerEmail.trim()) {
      next.ownerEmail = 'Owner email is required to deliver alerts.'
    } else if (!EMAIL_PATTERN.test(form.ownerEmail.trim())) {
      next.ownerEmail = 'Enter a valid email address.'
    }
    if (!/^\d{2}:\d{2}$/.test(form.notificationTime)) {
      next.notificationTime = 'Choose a valid notification time.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate()) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    setSaving(true)
    try {
      const saved = saveSettings(candidate)
      setForm(formFromSettings(saved))
      refresh()
      toast.success('Email and automation settings saved.')
    } catch (error) {
      toast.error(error?.message || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!validate()) {
      toast.error('Please fix the highlighted fields before sending a test.')
      return
    }
    if (!emailStatus.configured) {
      toast.error(`Email is not configured. Add ${emailStatus.missing.join(', ')}.`)
      return
    }
    setTesting(true)
    try {
      const result = await sendTestEmail(candidate)
      setLastTest(result)
      refresh()
      if (result.status === 'success') {
        toast.success('Test email sent. Check the owner inbox.')
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error(error?.message || 'Could not send the test email.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Configuration"
        title="Email Settings"
        description="Connect EmailJS, choose when the daily alert runs, and test delivery. Credentials and settings stay in this browser's LocalStorage."
        actions={
          <>
            <Button variant="secondary" onClick={handleTest} loading={testing} disabled={testing || saving}>
              <Send size={15} />
              Send Test Email
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={saving || testing}>
              <Save size={15} />
              Save Settings
            </Button>
          </>
        }
      />

      {dirty ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
          You have unsaved changes. Save to apply the notification schedule and email credentials.
        </div>
      ) : null}

      {lastTest ? (
        <div
          className={`mb-4 flex flex-col gap-2 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${
            lastTest.status === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span className="font-medium">{lastTest.message}</span>
          <span className="text-[10px] opacity-70">
            {lastTest.history?.sentAt ? formatDateTime(lastTest.history.sentAt) : ''}
          </span>
        </div>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Store and recipient"
              description="Used in the email greeting, footer and the To field."
              action={<Mail size={18} className="text-brand-700" />}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Store / Owner Name" htmlFor="ownerName" hint="Shown as the sender name in the email body.">
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={(event) => update('ownerName', event.target.value)}
                  placeholder="e.g. Sharma Grocery Store"
                  autoComplete="organization"
                />
              </Field>
              <Field
                label="Owner Email"
                htmlFor="ownerEmail"
                required
                error={errors.ownerEmail}
                hint="All expiry alerts and test emails are delivered here."
              >
                <Input
                  id="ownerEmail"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(event) => update('ownerEmail', event.target.value)}
                  placeholder="owner@example.com"
                  invalid={Boolean(errors.ownerEmail)}
                  autoComplete="email"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="EmailJS credentials"
              description="Create a free EmailJS account, then copy the Service ID, Template ID and Public Key."
              action={<Settings2 size={18} className="text-brand-700" />}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="Service ID"
                htmlFor="serviceId"
                hint={config.serviceFromEnv ? 'Using VITE_EMAILJS_SERVICE_ID from .env' : 'Example: service_abc1234'}
              >
                <Input
                  id="serviceId"
                  value={form.emailJsServiceId}
                  onChange={(event) => update('emailJsServiceId', event.target.value)}
                  placeholder="service_xxxxxxx"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="Template ID"
                htmlFor="templateId"
                hint={config.templateFromEnv ? 'Using VITE_EMAILJS_TEMPLATE_ID from .env' : 'Example: template_xyz9876'}
              >
                <Input
                  id="templateId"
                  value={form.emailJsTemplateId}
                  onChange={(event) => update('emailJsTemplateId', event.target.value)}
                  placeholder="template_xxxxxxx"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="Public Key"
                htmlFor="publicKey"
                className="sm:col-span-2"
                hint={
                  config.publicKeyFromEnv
                    ? 'Using VITE_EMAILJS_PUBLIC_KEY from .env'
                    : 'Safe to use in the browser. Never add an EmailJS private key here.'
                }
              >
                <Input
                  id="publicKey"
                  value={form.emailJsPublicKey}
                  onChange={(event) => update('emailJsPublicKey', event.target.value)}
                  placeholder="Public key from EmailJS account settings"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              {emailStatus.configured ? (
                <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                  <ShieldCheck size={14} />
                  Email configuration is complete and ready to send.
                </p>
              ) : (
                <p className="text-xs text-amber-700">
                  Missing: <strong>{emailStatus.missing.join(', ')}</strong>. Fields left blank fall back
                  to matching <code className="rounded bg-slate-100 px-1">VITE_EMAILJS_*</code> environment values.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Automation"
              description="Alerts are checked while the app is open; the default is 10:30 AM IST."
              action={<Bell size={18} className="text-brand-700" />}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field
                label="Daily notification time (IST)"
                htmlFor="notificationTime"
                error={errors.notificationTime}
                hint={`Email scheduled for ${formatNotificationTime(form.notificationTime)} India time.`}
              >
                <Input
                  id="notificationTime"
                  type="time"
                  value={form.notificationTime}
                  onChange={(event) => update('notificationTime', event.target.value)}
                  invalid={Boolean(errors.notificationTime)}
                />
              </Field>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <Checkbox
                  label="Enable automatic daily expiry email"
                  checked={form.notificationsEnabled}
                  onChange={(event) => update('notificationsEnabled', event.target.checked)}
                />
                <Checkbox
                  label="Also include already-expired products in the email"
                  checked={form.includeExpiredInEmail}
                  onChange={(event) => update('includeExpiredInEmail', event.target.checked)}
                />
              </div>
            </div>
            <div className="flex items-start gap-2 border-t border-slate-100 px-5 py-3 text-[11px] leading-5 text-slate-500">
              <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
              One scheduled attempt is made per calendar day after the selected time. If no products
              qualify, the attempt is logged as skipped and counted for the day.
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Scheduler status"
              description="Reflects the last saved settings."
              action={<Clock3 size={18} className="text-brand-700" />}
            />
            <dl className="divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-slate-500">Automatic emails</dt>
                <dd>
                  <Badge tone={scheduler.enabled ? 'green' : 'slate'} dot>
                    {scheduler.enabled ? 'Enabled' : 'Paused'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-slate-500">Delivery setup</dt>
                <dd>
                  <Badge tone={scheduler.configured ? 'green' : 'amber'} dot>
                    {scheduler.configured ? 'Configured' : 'Incomplete'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-slate-500">Next run</dt>
                <dd className="text-right font-semibold text-slate-800">{scheduler.nextRunLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-slate-500">Last successful alert</dt>
                <dd className="text-right text-slate-700">
                  {scheduler.lastScheduledAlertDate || 'None yet'}
                </dd>
              </div>
              <div className="px-5 py-3">
                <dt className="text-slate-500">Last scheduled result</dt>
                <dd className="mt-1.5 text-slate-700">
                  {scheduler.lastScheduledResult ? (
                    <>
                      <Badge tone={statusTone(scheduler.lastScheduledResult.status)} dot>
                        {scheduler.lastScheduledResult.status}
                      </Badge>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {scheduler.lastScheduledResult.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {formatDateTime(scheduler.lastScheduledResult.at)}
                      </p>
                    </>
                  ) : (
                    'No scheduled attempt recorded.'
                  )}
                </dd>
              </div>
            </dl>
            <div className="border-t border-slate-100 px-5 py-3">
              <Button variant="secondary" size="sm" onClick={handleSave} loading={saving} disabled={saving}>
                <Save size={14} />
                Save and apply
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent email history"
              description="Last six delivery attempts."
              action={
                <Link
                  to="/expiry-alerts"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:underline"
                >
                  View all
                  <ExternalLink size={12} />
                </Link>
              }
            />
            {recentHistory.length ? (
              <ul className="divide-y divide-slate-100">
                {recentHistory.map((entry) => (
                  <li key={entry.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={statusTone(entry.status)} dot>
                        {entry.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(entry.sentAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-xs font-medium text-slate-700" title={entry.recipient}>
                      {entry.recipient}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                      {entry.message}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-5 py-8 text-center">
                <History size={20} className="mx-auto text-slate-300" />
                <p className="mt-2 text-xs text-slate-500">No email attempts logged yet.</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="EmailJS template setup" description="Use these variables in your template." />
            <div className="space-y-3 px-5 py-4 text-[11px] leading-5 text-slate-600">
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>Create a service and an email template in EmailJS.</li>
                <li>
                  Set <strong>To Email</strong> to{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{to_email}}'}</code> and{' '}
                  <strong>Subject</strong> to{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{subject}}'}</code>.
                </li>
                <li>
                  In the template body choose <strong>HTML</strong> and set{' '}
                  <code className="rounded bg-slate-100 px-1">{'{{{html_body}}}'}</code>{' '}
                  (triple braces) so the alert table renders.
                </li>
                <li>
                  Optional variables: shop_name, owner_name, products_table, expiring_count,
                  expiring_today_count, expired_count, generated_at.
                </li>
                <li>Paste the Service ID, Template ID and Public Key above, then send a test.</li>
              </ol>
              <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sky-800">
                Browser-only scheduling cannot run while the app is closed. For guaranteed 10:30 AM
                delivery, move the send call to a server cron job or a Postman Monitor.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
