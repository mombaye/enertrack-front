// src/features/fuel-tracking/FuelTrackingPage.tsx
//
// Module suivi-carburant : automatisé, plus d'import manuel de fichier.
// 4 sous-parties construites étape par étape :
//   - Dashboard   : résumé automatique des 3 autres parties (pas encore
//                   alimenté — en attente que Consommation/Stock/Commande
//                   soient toutes automatisées).
//   - Consommation: automatisée (Snowflake DB_GFMS_PROD.GOLD + ENOC), voir
//                   fuel_tracking/services/fuel_consommation_snowflake.py et
//                   la commande sync_fuel_consommation côté backend.
//   - Stock       : à venir.
//   - Commande    : à venir.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, Droplets, Fuel, LayoutGrid, RefreshCw, Warehouse } from "lucide-react";

import { getFuelConsommation, type FuelSourceStatus } from "@/services/fuelTracking";

import { FT } from "./theme";
import { GLOBAL_STYLES, SegmentedTabs } from "./ui";
import { ConsommationSheet } from "./sheets/ConsommationSheet";
import { PlaceholderSheet } from "./sheets/PlaceholderSheet";

type MainTab = "DASHBOARD" | "CONSOMMATION" | "STOCK" | "COMMANDE";

const MAIN_TABS: Array<{ key: MainTab; label: string; icon: ReactNode }> = [
  { key: "DASHBOARD", label: "Dashboard", icon: <LayoutGrid size={14} /> },
  { key: "CONSOMMATION", label: "Suivis Consommations", icon: <Droplets size={14} /> },
  { key: "STOCK", label: "Suivis Stock", icon: <Warehouse size={14} /> },
  { key: "COMMANDE", label: "Commandes", icon: <Fuel size={14} /> },
];

/** Pastille de statut d'une source de données (connectée/non connectée),
 * avec le détail (dernière synchro, erreur) en info-bulle. */
function SourceBadge({ label, status }: { label: string; status: FuelSourceStatus | undefined }) {
  const connected = !!status?.connected;
  const title = status?.error
    ? `${label} : ${status.error}`
    : status?.last_run_at
      ? `${label} : dernière synchro ${new Date(status.last_run_at).toLocaleString("fr-FR")}`
      : `${label} : jamais synchronisé`;

  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
        fontSize: 11, fontWeight: 800, border: `1px solid ${connected ? FT.greenL : FT.redL}`,
        background: connected ? FT.greenL : FT.redL, color: connected ? FT.green : FT.red, cursor: "help",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", flexShrink: 0 }} />
      {label}
    </span>
  );
}

export default function FuelTrackingPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("DASHBOARD");
  const [month, setMonth] = useState<string | null>(null);
  const [consoSearch, setConsoSearch] = useState("");
  const [consoPage, setConsoPage] = useState(1);
  const [consoGeFilter, setConsoGeFilter] = useState<"all" | "true" | "false">("all");

  // Hauteur réelle du header (fixe) — sert de décalage aux stats sticky
  // affichées juste en dessous, pour qu'elles restent visibles au défilement
  // sans jamais passer sous le header.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    setHeaderHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => setHeaderHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pas de `enabled` sur l'onglet actif : le statut des sources (badges du
  // header) doit rester visible même hors de l'onglet Consommation.
  const consommationQ = useQuery({
    queryKey: ["fuel-consommation", month, consoSearch, consoPage, consoGeFilter],
    queryFn: () => getFuelConsommation({
      month: month ?? undefined,
      search: consoSearch,
      page: consoPage,
      limit: 50,
      has_genset: consoGeFilter === "all" ? undefined : consoGeFilter,
    }),
    staleTime: 60_000,
  });

  // Premier chargement (month encore null) : on adopte le mois résolu par le
  // backend (le plus récent synchronisé), pour que le champ mois affiche cette valeur.
  useEffect(() => {
    if (month === null && consommationQ.data?.month_year) {
      setMonth(consommationQ.data.month_year);
    }
  }, [month, consommationQ.data?.month_year]);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="fuelbook" style={{ display: "flex", flexDirection: "column", gap: 14, background: FT.pageBg, margin: -20, padding: 20 }}>
        <div
          ref={headerRef}
          className="ft-fade"
          style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", border: `1px solid ${FT.border}`, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "20px 24px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: FT.blueL, display: "grid", placeItems: "center", color: FT.gold }}>
                <BarChart3 size={16} />
              </div>
              <div>
                <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, lineHeight: 1.25, fontWeight: 900, letterSpacing: "-.03em" }}>Suivi Carburant</h1>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Suivi automatisé de la consommation, du stock et des commandes carburant.</p>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <SourceBadge label="Snowflake" status={consommationQ.data?.sources?.snowflake} />
                  <SourceBadge label="ENOC" status={consommationQ.data?.sources?.enoc} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "7px 11px" }}>
                <Calendar size={14} color={FT.textSub} />
                <input
                  type="month"
                  value={month ?? consommationQ.data?.month_year ?? ""}
                  onChange={(e) => setMonth(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 }}
                />
              </div>

              <button
                onClick={() => consommationQ.refetch()}
                title="Rafraîchir"
                style={{ width: 33, height: 33, borderRadius: 9, border: `1px solid ${FT.border}`, background: FT.slateL, display: "grid", placeItems: "center", cursor: "pointer", color: FT.textMid, flexShrink: 0 }}
              >
                <RefreshCw size={14} className={consommationQ.isFetching ? "ft-spin" : ""} />
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${FT.border}`, display: "flex", justifyContent: "center" }}>
            <SegmentedTabs options={MAIN_TABS} value={activeTab} onChange={setActiveTab} />
          </div>
        </div>

        {activeTab === "DASHBOARD" && (
          <div className="ft-fade">
            <PlaceholderSheet
              icon={<LayoutGrid size={17} />}
              title="Dashboard"
              subtitle="Résumé automatique de Consommation, Stock et Commande."
              emptyTitle="Aucune donnée pour le moment"
              emptyMessage="Le résumé sera alimenté automatiquement une fois les 3 sous-parties synchronisées depuis leurs sources de données."
            />
          </div>
        )}

        {activeTab === "CONSOMMATION" && (
          <div className="ft-fade">
            <ConsommationSheet
              data={consommationQ.data}
              loading={consommationQ.isLoading}
              search={consoSearch}
              onSearchChange={(v) => {
                setConsoSearch(v);
                setConsoPage(1);
              }}
              geFilter={consoGeFilter}
              onGeFilterChange={(v) => {
                setConsoGeFilter(v);
                setConsoPage(1);
              }}
              page={consoPage}
              onPageChange={setConsoPage}
              stickyTop={headerHeight}
            />
          </div>
        )}

        {activeTab === "STOCK" && (
          <div className="ft-fade">
            <PlaceholderSheet
              icon={<Warehouse size={17} />}
              title="Stock"
              subtitle="Suivi automatisé du stock carburant par site."
              emptyTitle="On va y travailler bientôt"
              emptyMessage="Cette sous-partie sera automatisée sur le même principe que Consommation."
            />
          </div>
        )}

        {activeTab === "COMMANDE" && (
          <div className="ft-fade">
            <PlaceholderSheet
              icon={<Fuel size={17} />}
              title="Commande"
              subtitle="Suivi automatisé des commandes carburant."
              emptyTitle="On va y travailler bientôt"
              emptyMessage="Cette sous-partie sera automatisée sur le même principe que Consommation."
            />
          </div>
        )}
      </div>
    </>
  );
}
