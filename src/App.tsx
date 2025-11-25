import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouteGuard } from "@/routes/RouteGuard";
import MainLayout from "@/layouts/MainLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import SitesPage from "@/pages/SitesPage";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/auth/AuthContext";
import InvoicesPage from "@/pages/InvoicesPage";
import EnergyPage from "@/pages/EnergyPage";
import SiteEnergyPage from "./pages/SiteEnergyPage";
import EnergyTabsPage from "@/pages/EnergyTabsPage";
import RectifiersPage from "@/pages/RectifiersPage";
import PowerQualityPage from "./pages/PowerQualityPage";
import PwmReportsPage from "@/pages/PwmReportsPage";
import SonatelBillingPage from "@/pages/SonatelBillingPage";
import GridOutagesPage from "@/pages/GridOutagesPage"; // ⬅️ nouveau
// ...

function App() {
  return (
    <>
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
                  {/* ... */}
                 <Route path="/energy" element={<RouteGuard allowedRoles={["admin","analyst"]} />}>
                    <Route index element={<EnergyTabsPage />} />
                  </Route>

                  <Route path="/rectifiers" element={<RouteGuard allowedRoles={["admin","analyst"]} />}>
                      <Route index element={<RectifiersPage />} />
                  </Route>

                  <Route
                    path="/power-quality"
                    element={<RouteGuard allowedRoles={["admin","analyst"]} />}
                  >
                    <Route index element={<PowerQualityPage />} />
                  </Route>

                  <Route
                      path="/pwm"
                      element={<RouteGuard allowedRoles={["admin", "analyst"]} />}
                    >
                      <Route index element={<PwmReportsPage />} />
                  </Route>
                  <Route
                    path="/billing/sonatel"
                    element={<RouteGuard allowedRoles={["admin","analyst"]} />}>
                    <Route index element={<SonatelBillingPage />} />
                  </Route>

                  <Route
                    path="/grid-outages"
                    element={<RouteGuard allowedRoles={["admin", "analyst"]} />}
                  >
                    <Route index element={<GridOutagesPage />} />
                  </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <ToastContainer position="top-center" />
      </AuthProvider>
      <ToastContainer position="top-center" />
    </>
  );
}

export default App;
