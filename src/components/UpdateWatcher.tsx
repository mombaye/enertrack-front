// Détecte un nouveau déploiement (version.json, jamais en cache) et met l'application à jour sans action manuelle :
// rechargement automatique au prochain changement de page (aucune saisie perdue) + bandeau pour recharger tout de suite.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

declare const __BUILD_ID__: string;
const CURRENT = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
const POLL_MS = 60_000;

async function latestBuild(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
    const j = (await r.json()) as { build?: string };
    return j.build ?? null;
  } catch {
    return null;                       // réseau indisponible : on ne fait rien
  }
}

export function UpdateWatcher() {
  const [stale, setStale] = useState(false);
  const { pathname } = useLocation();
  const lastPath = useRef(pathname);
  const staleRef = useRef(false);
  staleRef.current = stale;

  useEffect(() => {
    if (CURRENT === "dev") return;
    let stop = false;
    const check = async () => {
      const b = await latestBuild();
      if (!stop && b && b !== CURRENT) setStale(true);
    };
    check();
    const id = window.setInterval(check, POLL_MS);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => { stop = true; window.clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, []);

  // Une mise à jour est disponible : on recharge au PROCHAIN changement de page (jamais pendant une saisie).
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (staleRef.current) window.location.reload();
  }, [pathname]);

  if (!stale) return null;
  return (
    <div role="status" style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000, background: "#0B1F4D", color: "#fff", padding: "10px 14px", borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,.3)", display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
      <span>Une nouvelle version de l'application est disponible.</span>
      <button type="button" onClick={() => window.location.reload()} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#fff", color: "#0B1F4D", fontWeight: 800, cursor: "pointer" }}>Mettre à jour</button>
    </div>
  );
}
