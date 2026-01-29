import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Eye, EyeOff, Lock, User } from "lucide-react";

import camusatLogo from "@/assets/images/camusat-logo.png";
import { useAuth } from "@/auth/AuthContext";
import { authApi } from "@/services/api";

type FormValues = { username: string; password: string };

async function loginUser(username: string, password: string) {
  const res = await authApi.post("/auth/login/", { username, password });
  return res.data as { access: string; refresh: string };
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const fromPath = useMemo(
    () => (location.state as any)?.from?.pathname || "/dashboard",
    [location.state]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { username: "", password: "" },
  });

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const res = await loginUser(data.username, data.password);
      login(res.access, res.refresh);
      navigate(fromPath, { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Identifiants invalides. Réessaie.";
      toast.error(msg, { autoClose: 4000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-blue-900">
      {/* Background effects (blue-900 base) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute top-24 -right-24 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-800/30 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-950 via-blue-900 to-blue-700/40 opacity-95" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel */}
          <div className="hidden lg:flex flex-col justify-center p-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <img src={camusatLogo} alt="Camusat" className="h-10 w-auto mb-8 opacity-95" />

            <h1 className="text-white text-3xl font-semibold leading-tight">
              Plateforme d’analyse <span className="text-white/90">Énergie & Réseau</span>
            </h1>

            <p className="mt-3 text-white/70">
              Suivi des factures, synthèses mensuelles, indicateurs de performance et événements réseau (grid).
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="text-white font-medium">Accès sécurisé</div>
                <div className="text-white/70 text-sm">
                  Authentification par jetons et droits d’accès selon le profil.
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="text-white font-medium">Données consolidées</div>
                <div className="text-white/70 text-sm">
                  Imports contrôlés, suivi des anomalies et traçabilité des corrections.
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="text-white font-medium">Pilotage & reporting</div>
                <div className="text-white/70 text-sm">
                  Analyse multi-sites, comparaisons, alertes et exports pour décision.
                </div>
              </div>
            </div>

            <div className="mt-10 text-xs text-white/50">
              © Camusat — Plateforme d’analyse Énergie & Réseau
            </div>
          </div>

          {/* Right card */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-8">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <img src={camusatLogo} alt="Camusat" className="h-7 w-auto" />
                </div>
                <div>
                  <div className="text-white text-lg font-semibold">Connexion</div>
                  <div className="text-white/60 text-sm">Accède à ton espace d’analyse</div>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
                {/* Username */}
                <label className="block">
                  <span className="text-white/70 text-sm">Nom d’utilisateur</span>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 focus-within:border-white/30">
                    <User className="h-5 w-5 text-white/60" />
                    <input
                      className="w-full bg-transparent outline-none text-white placeholder:text-white/35"
                      placeholder="ex: prenom.nom"
                      {...register("username", { required: "Identifiant requis" })}
                      autoComplete="username"
                    />
                  </div>
                  {errors.username && (
                    <div className="mt-2 text-sm text-red-200">{errors.username.message}</div>
                  )}
                </label>

                {/* Password */}
                <label className="block">
                  <span className="text-white/70 text-sm">Mot de passe</span>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 focus-within:border-white/30">
                    <Lock className="h-5 w-5 text-white/60" />
                    <input
                      className="w-full bg-transparent outline-none text-white placeholder:text-white/35"
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      {...register("password", { required: "Mot de passe requis" })}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="text-white/60 hover:text-white transition"
                      aria-label={showPw ? "Masquer" : "Afficher"}
                    >
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <div className="mt-2 text-sm text-red-200">{errors.password.message}</div>
                  )}
                </label>

                <button
                  disabled={loading}
                  className="mt-2 w-full rounded-2xl bg-white text-blue-900 font-semibold py-3
                             hover:bg-white/90 active:bg-white/80 transition
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Connexion..." : "Se connecter"}
                </button>

                <div className="pt-3 text-center text-xs text-white/50">
                  En cas de session expirée, reconnecte-toi pour continuer.
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
