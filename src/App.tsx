import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RouteGuard } from "@/routes/RouteGuard";
import MainLayout from "@/layouts/MainLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import SitesPage from "@/pages/SitesPage";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "./auth/AuthContext";
import InvoicesPage from "./pages/InvoicesPage";
// ...

function App() {
  return (
    <>
       <AuthProvider>
        <BrowserRouter>
          <Routes>
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
