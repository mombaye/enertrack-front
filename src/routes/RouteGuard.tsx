import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

interface RouteGuardProps {
  allowedRoles?: string[];
}

export function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // 1) Non authentifié → /login (on garde la cible pour post-login)
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, reason: "auth_required" }}
      />
    );
  }

  // 2) Authentifié mais rôle non autorisé → /login aussi
  if (allowedRoles?.length && (!user || !allowedRoles.includes(user.role))) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, reason: "forbidden" }}
      />
    );
  }

  // 3) OK
  return <Outlet />;
}
