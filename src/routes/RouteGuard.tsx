import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

interface RouteGuardProps {
  allowedRoles?: string[]; // exemple : ["admin", "manager"]
}

export function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { isAuthenticated, user } = useAuth();

  // 1. Pas authentifié ? Redirection login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // 2. S'il y a des rôles à vérifier, on contrôle le rôle utilisateur
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !allowedRoles.includes(user.role)) {
      return <Navigate to="/forbidden" replace />; // ou une page 403 custom
    }
  }

  // 3. OK : on rend la route protégée
  return <Outlet />;
}
