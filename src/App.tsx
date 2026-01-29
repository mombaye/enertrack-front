// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouteGuard } from "@/routes/RouteGuard";
import MainLayout from "@/layouts/MainLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import SitesPage from "@/pages/SitesPage";
import InvoicesPage from "@/pages/InvoicesPage";
import SonatelBillingPage from "@/pages/SonatelBillingPage";

import SonatelConfigPage from "@/features/sonatelBilling/admin/SonatelConfigPage";
import TariffRatesAdminPage from "@/features/sonatelBilling/admin/TariffRatesAdminPage";
import ContractSiteLinksAdminPage from "@/features/sonatelBilling/admin/ContractSiteLinksAdminPage";
import BillingComputePage from "@/features/sonatelBilling/admin/BillingComputePage";
import StatusUpdateAdminPage from "@/features/sonatelBilling/admin/StatusUpdateImportPage";

import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/auth/AuthContext";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InvoicesImportPage from "./features/sonatelBilling/InvoicesImportPage";
import StatusUpdateImportPage from "@/features/sonatelBilling/admin/StatusUpdateImportPage";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RouteGuard />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<RouteGuard allowedRoles={["admin", "analyst"]} />}>
                  <Route index element={<DashboardPage />} />
                </Route>

                <Route path="/sites" element={<RouteGuard allowedRoles={["admin", "analyst"]} />}>
                  <Route index element={<SitesPage />} />
                </Route>

                <Route path="/invoices" element={<RouteGuard allowedRoles={["admin", "analyst"]} />}>
                  <Route index element={<InvoicesPage />} />
                </Route>

                <Route path="/billing/sonatel" element={<RouteGuard allowedRoles={["admin", "analyst"]} />}>
                  <Route index element={<SonatelBillingPage />} />
                </Route>

                  <Route path="/billing/sonatel/config" element={<RouteGuard allowedRoles={["admin"]} />}>
                    <Route element={<SonatelConfigPage />}>
                      {/* ✅ /billing/sonatel/config -> /billing/sonatel/config/tariffs */}
                      <Route index element={<Navigate to="tariffs" replace />} />
                      <Route path="tariffs" element={<TariffRatesAdminPage />} />
                      <Route path="contract-sites" element={<ContractSiteLinksAdminPage />} />
                      <Route path="import-invoices" element={<InvoicesImportPage />} />
                      <Route path="status-update" element={<StatusUpdateImportPage />} />
                      <Route path="compute" element={<BillingComputePage />} />
                    </Route>
                  </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>

        <ToastContainer position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
