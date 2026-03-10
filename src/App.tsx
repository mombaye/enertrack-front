// App.tsx  — ajouter les imports et la route certification
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
import InvoicesImportPage from "./features/sonatelBilling/InvoicesImportPage";
import StatusUpdateImportPage from "@/features/sonatelBilling/admin/StatusUpdateImportPage";

// ✅ NOUVEAU — Module Certification
import CertificationPage from "@/features/certification/CertificationPage";

import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/auth/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UsersPage from "./features/users/Userspage";
import ComingSoonPage from "./components/Comingsoonpage";
import { AlertTriangle, BarChart2, Calculator, Server, Zap } from "lucide-react";

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

                {/* ✅ NOUVEAU — Certification */}
                <Route path="/certification" element={<RouteGuard allowedRoles={["admin", "analyst"]} />}>
                  <Route index element={<CertificationPage />} />
                </Route>

                <Route path="/billing/sonatel/config" element={<RouteGuard allowedRoles={["admin"]} />}>
                  <Route element={<SonatelConfigPage />}>
                    <Route index element={<Navigate to="tariffs" replace />} />
                    <Route path="tariffs" element={<TariffRatesAdminPage />} />
                    <Route path="contract-sites" element={<ContractSiteLinksAdminPage />} />
                    <Route path="import-invoices" element={<InvoicesImportPage />} />
                    <Route path="status-update" element={<StatusUpdateImportPage />} />
                    <Route path="compute" element={<BillingComputePage />} />
                  </Route>
                </Route>



                <Route
                  path="/modules/estimation"
                  element={
                    <ComingSoonPage
                      moduleName="Estimation"
                      description="Estimez la consommation prévisionnelle de vos sites à partir des données FMS et de l'historique Sénélec."
                      icon={<Calculator size={38} color="rgba(255,255,255,0.85)" />}
                    />
                  }
                />

                <Route
                  path="/modules/optimisation"
                  element={
                    <ComingSoonPage
                      moduleName="Optimisation de Puissance & Tarif"
                      description="Identifiez les leviers tarifaires et optimisez la puissance souscrite pour réduire vos coûts énergétiques."
                      icon={<Zap size={38} color="rgba(255,255,255,0.85)" />}
                    />
                  }
                />

                <Route
                  path="/modules/suivi-conso"
                  element={
                    <ComingSoonPage
                      moduleName="Suivi Conso"
                      description="Suivez en temps réel la consommation de chaque site et détectez les anomalies de facturation."
                      icon={<BarChart2 size={38} color="rgba(255,255,255,0.85)" />}
                    />
                  }
                />

                <Route
                  path="/modules/suivi-penalites"
                  element={
                    <ComingSoonPage
                      moduleName="Suivi Pénalités"
                      description="Centralisez et analysez toutes les pénalités facturées par Sénélec sur l'ensemble de votre parc."
                      icon={<AlertTriangle size={38} color="rgba(255,255,255,0.85)" />}
                    />
                  }
                />

                <Route
                  path="/modules/suivi-fms"
                  element={
                    <ComingSoonPage
                      moduleName="Suivi FMS"
                      description="Monitoring de la disponibilité et de la qualité des données remontées par les compteurs FMS."
                      icon={<Server size={38} color="rgba(255,255,255,0.85)" />}
                    />
                  }
                />

                <Route path="/users" element={<RouteGuard allowedRoles={["admin", "analyst"]} />}>
                  <Route index element={<UsersPage />} />
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