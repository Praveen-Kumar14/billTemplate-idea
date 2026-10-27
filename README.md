# Grocery Billing & Expiry Alert Management

A local-first grocery management app for a small shop. Track products and batches, record purchases and sales, print customer receipts, review reports, and email expiry alerts for products expiring within 5 days.

Built with React, Vite, Tailwind CSS, React Router, Lucide icons, Recharts, and EmailJS. All business data is stored in the browser's LocalStorage; there is no backend.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The first load seeds 14 grocery products, multiple stock batches, sample purchases, sample sales, and an expiry-focused email history. Existing LocalStorage data is never overwritten on reload.

Other scripts:

```bash
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # oxlint
```

## EmailJS setup

1. Create an account at [EmailJS](https://www.emailjs.com/), add an email service, and create a template.
2. Set the template **To Email** to `{{to_email}}` and **Subject** to `{{subject}}`.
3. Set the template body to HTML and use `{{{html_body}}}` (triple braces) so the product table renders. Also available: `{{message}}` for the plain-text version, `{{products_table}}`, `{{shop_name}}`, `{{owner_name}}`, `{{expiring_count}}`, `{{expiring_today_count}}`, `{{expired_count}}`, and `{{generated_at}}`.
4. Open **Email Settings** in the app and enter the owner email, service ID, template ID, and public key. Alternatively copy `.env.example` to `.env` and set:

```bash
VITE_EMAILJS_SERVICE_ID=service_xxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxx
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

Values entered in the app take precedence over environment values. Only the EmailJS **public** key belongs in a browser application. Never commit `.env` or a private key.

The expiry email subject is:

```
Grocery Expiry Alert – Products Expiring Within 5 Days
```

Use **Send Test Email** in Email Settings to verify delivery, then use **Send Expiry Alert Email Now** on the Dashboard or Expiry Alerts page.

## Expiry rules

- Expiry uses calendar dates in the `Asia/Kolkata` timezone, not millisecond differences.
- Products with `0 ≤ days remaining ≤ 5` are included in expiry alerts, including the fifth day.
- Expired stock (`days remaining < 0`) is listed separately and cannot be sold.
- Products within 5 days are amber; expired products are red; safe products are green.
- Sales deduct stock using FEFO (First Expired, First Out) across non-expired batches.
- Each purchase line creates a separate batch, so different expiry dates for the same product are preserved.

## Daily 10:30 AM scheduler

The app checks once per calendar day at or after 10:30 AM IST while it is open, every 30 seconds, and again when the window regains focus or visibility. A successful send records `lastScheduledAlertDate`; the daily check is recorded separately so the app does not repeatedly send.

**Browser limitation:** LocalStorage and browser timers cannot run while the app is closed, the browser is terminated, or the device is offline. Reopening the app triggers a catch-up check. Reliable 10:30 AM delivery requires a server-side scheduler such as `node-cron` plus a persistent data store, or a scheduled cloud function / Postman Monitor that reads synced product data. The scheduler service is isolated so the browser check can be replaced by a backend job later.

## Data storage

LocalStorage keys:

| Key | Contents |
| --- | --- |
| `grocery_products` | Product master records |
| `grocery_batches` | Batch-level stock and expiry |
| `grocery_purchases` | Purchase line transactions |
| `grocery_sales` | Sales invoices with line items |
| `grocery_settings` | Owner, EmailJS IDs, notification and scheduler state |
| `grocery_email_history` | Every email attempt, recipient, status and timestamp |

Additional initialization keys: `grocery_initialized_v1` and `grocery_schema_version`.

To reset to seeded demo data, open DevTools and remove the `grocery_*` keys, then reload:

```js
Object.keys(localStorage)
  .filter((key) => key.startsWith('grocery_'))
  .forEach((key) => localStorage.removeItem(key))
location.reload()
```

## Project structure

```text
src/
├── components/       # layout, UI, reports
├── context/          # data and toast contexts
├── data/             # dummy seed data
├── hooks/            # scheduler hook
├── pages/            # dashboard, products, purchase, sales, reports, expiry, email settings
├── services/         # storage, products, purchases, sales, expiry, email, scheduler
└── utils/            # date, calculation, CSV, print, ID helpers
```

## Notes

- This is a frontend prototype. Settings and data live only in the current browser profile.
- Deleting a product removes its batches from active stock; historical transaction records keep their snapshot values.
- Reports, dashboard totals, and expiry alerts are derived from stored records, not hardcoded values.
