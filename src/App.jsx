import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import DataProvider from './context/DataProvider'
import ToastProvider from './components/ui/ToastProvider'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import PurchaseEntry from './pages/PurchaseEntry'
import SalesBilling from './pages/SalesBilling'
import PurchaseReport from './pages/PurchaseReport'
import SalesReport from './pages/SalesReport'
import ExpiryAlerts from './pages/ExpiryAlerts'
import EmailSettings from './pages/EmailSettings'

export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <ToastProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="purchase-entry" element={<PurchaseEntry />} />
              <Route path="sales-billing" element={<SalesBilling />} />
              <Route path="purchase-report" element={<PurchaseReport />} />
              <Route path="sales-report" element={<SalesReport />} />
              <Route path="expiry-alerts" element={<ExpiryAlerts />} />
              <Route path="email-settings" element={<EmailSettings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </DataProvider>
    </HashRouter>
  )
}
