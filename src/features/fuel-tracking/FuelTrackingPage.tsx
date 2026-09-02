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
import { BarChart3, Calculator, Calendar, Droplets, Fuel, LayoutGrid, RefreshCw, Warehouse } from "lucide-react";

import {
  getFuelCommandeEstimation,
  getFuelCommandes,
  getFuelConsommation,
  getFuelConsommationDashboard,
  getFuelStock,
  type FuelGeDetectionFilter,
  type FuelSourceStatus,
} from "@/services/fuelTracking";

import { FT } from "./theme";
import { GLOBAL_STYLES, SegmentedTabs } from "./ui";
import { ConsommationSheet } from "./sheets/ConsommationSheet";
import { DashboardSheet } from "./sheets/DashboardSheet";
import { StockSheet } from "./sheets/StockSheet";
import { CommandeSheet } from "./sheets/CommandeSheet";
import { EstimationSheet } from "./sheets/EstimationSheet";

type MainTab = "DASHBOARD" | "CONSOMMATION" | "STOCK" | "COMMANDE" | "ESTIMATION";

const MAIN_TABS: Array<{ key: MainTab; label: string; icon: ReactNode }> = [
  { key: "DASHBOARD", label: "Dashboard", icon: <LayoutGrid size={14} /> },
  { key: "CONSOMMATION", label: "Suivis Consommations", icon: <Droplets size={14} /> },
  { key: "STOCK", label: "Suivis Stock", icon: <Warehouse size={14} /> },
  { key: "COMMANDE", label: "Commandes", icon: <Fuel size={14} /> },
  { key: "ESTIMATION", label: "Estimation commande", icon: <Calculator size={14} /> },
];

/** Mois calendaire précédent le mois courant réel (pas lié aux données),
 * ex: le 2026-09-02 → "2026-08" — la plage de dates du header ne doit
 * jamais proposer le mois en cours par défaut : il vient tout juste de
 * commencer et n'a donc quasiment aucune donnée (couverture ~0%), ce qui
 * donnait l'impression trompeuse d'une régression/absence de données. */
function previousCalendarMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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
  // Le header pilote une PLAGE de 2 mois (pas un mois unique) — sert
  // directement le Dashboard (tendance) ; l'onglet Suivis Consommations
  // (tableau site×mois) utilise le mois le plus récent de cette plage
  // (`toMonth`). Initialisée automatiquement aux 3 derniers mois disponibles
  // dès la 1ère réponse du Dashboard (voir useEffect plus bas).
  const [fromMonth, setFromMonth] = useState<string | null>(null);
  const [toMonth, setToMonth] = useState<string | null>(null);
  const [consoSearch, setConsoSearch] = useState("");
  const [consoPage, setConsoPage] = useState(1);
  // Par défaut, Suivis Consommations n'affiche que les sites Avec GE (seuls
  // capables d'avoir une conso fuel) — demande explicite (2026-08), plutôt
  // que "Tous" qui noie la table avec les ~2850 sites sans GE.
  const [consoGeFilter, setConsoGeFilter] = useState<"all" | "true" | "false" | "incomplete">("true");
  const [consoDetectionFilter, setConsoDetectionFilter] = useState<FuelGeDetectionFilter | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);
  // Même défaut que Suivis Consommations — Avec GE (seuls capables d'avoir
  // du stock fuel), pas "Tous".
  const [stockGeFilter, setStockGeFilter] = useState<"all" | "true" | "false">("true");
  const [commandeSearch, setCommandeSearch] = useState("");
  const [commandePage, setCommandePage] = useState(1);
  const [estimationSearch, setEstimationSearch] = useState("");

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

  // Pas de `enabled` sur l'onglet actif (ni pour consommationQ ni pour
  // dashboardQ) : le statut des sources (badges du header) et la plage de
  // mois doivent rester à jour même hors de leurs onglets respectifs.
  const consommationQ = useQuery({
    queryKey: ["fuel-consommation", toMonth, consoSearch, consoPage, consoGeFilter, consoDetectionFilter],
    queryFn: () => getFuelConsommation({
      month: toMonth ?? undefined,
      search: consoSearch,
      page: consoPage,
      limit: 50,
      has_genset: consoDetectionFilter ? undefined : (consoGeFilter === "all" ? undefined : consoGeFilter),
      detection: consoDetectionFilter ?? undefined,
    }),
    staleTime: 60_000,
  });

  const dashboardQ = useQuery({
    queryKey: ["fuel-consommation-dashboard", fromMonth, toMonth],
    queryFn: () => getFuelConsommationDashboard({
      from_month: fromMonth ?? undefined,
      to_month: toMonth ?? undefined,
    }),
    staleTime: 60_000,
  });

  const stockQ = useQuery({
    queryKey: ["fuel-stock", stockSearch, stockPage, stockGeFilter],
    queryFn: () => getFuelStock({
      search: stockSearch,
      page: stockPage,
      limit: 50,
      has_genset: stockGeFilter === "all" ? undefined : stockGeFilter,
    }),
    // Aussi actif sur DASHBOARD : la section Stock du Dashboard réutilise
    // cette même requête (pas de duplication d'appel réseau).
    enabled: activeTab === "STOCK" || activeTab === "DASHBOARD",
    staleTime: 60_000,
  });

  const commandeQ = useQuery({
    queryKey: ["fuel-commandes", commandeSearch, commandePage],
    queryFn: () => getFuelCommandes({
      search: commandeSearch,
      page: commandePage,
      limit: 50,
    }),
    // Aussi actif sur DASHBOARD : la section Commandes du Dashboard
    // réutilise cette même requête (pas de duplication d'appel réseau).
    enabled: activeTab === "COMMANDE" || activeTab === "DASHBOARD",
    staleTime: 60_000,
  });

  const estimationQ = useQuery({
    queryKey: ["fuel-commande-estimation"],
    queryFn: () => getFuelCommandeEstimation(),
    enabled: activeTab === "ESTIMATION",
    staleTime: 60_000,
  });

  // Premier chargement (plage encore vide) : le backend retourne les
  // derniers mois disponibles, mais on plafonne toujours à M-1 (mois
  // calendaire précédent) — le mois en cours est alimenté en continu par la
  // synchro Celery et n'a donc quasiment aucune donnée à son tout début
  // (couverture ~0%), ce qui donnait l'impression trompeuse d'une panne.
  // L'estimation (mois M+1 par rapport aux données) a son propre onglet.
  useEffect(() => {
    if (fromMonth === null && toMonth === null && dashboardQ.data?.months?.length) {
      const cap = previousCalendarMonth();
      const months = dashboardQ.data.months.filter((m) => m <= cap);
      if (months.length) {
        setFromMonth(months[0]);
        setToMonth(months[months.length - 1]);
      } else {
        setFromMonth(cap);
        setToMonth(cap);
      }
    }
  }, [fromMonth, toMonth, dashboardQ.data?.months]);

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
                  value={fromMonth ?? ""}
                  max={toMonth ?? undefined}
                  onChange={(e) => setFromMonth(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 }}
                />
                <span style={{ color: FT.textSub, fontSize: 12 }}>à</span>
                <input
                  type="month"
                  value={toMonth ?? ""}
                  min={fromMonth ?? undefined}
                  max={previousCalendarMonth()}
                  onChange={(e) => setToMonth(e.target.value)}
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
            <DashboardSheet
              data={dashboardQ.data}
              loading={dashboardQ.isLoading}
              stockData={stockQ.data}
              stockLoading={stockQ.isLoading}
              commandeData={commandeQ.data}
              commandeLoading={commandeQ.isLoading}
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
              detectionFilter={consoDetectionFilter}
              onDetectionFilterChange={(v) => {
                setConsoDetectionFilter(v);
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
            <StockSheet
              data={stockQ.data}
              loading={stockQ.isLoading}
              search={stockSearch}
              onSearchChange={(v) => {
                setStockSearch(v);
                setStockPage(1);
              }}
              geFilter={stockGeFilter}
              onGeFilterChange={(v) => {
                setStockGeFilter(v);
                setStockPage(1);
              }}
              page={stockPage}
              onPageChange={setStockPage}
              stickyTop={headerHeight}
            />
          </div>
        )}

        {activeTab === "COMMANDE" && (
          <div className="ft-fade">
            <CommandeSheet
              data={commandeQ.data}
              loading={commandeQ.isLoading}
              search={commandeSearch}
              onSearchChange={(v) => {
                setCommandeSearch(v);
                setCommandePage(1);
              }}
              page={commandePage}
              onPageChange={setCommandePage}
              stickyTop={headerHeight}
            />
          </div>
        )}

        {activeTab === "ESTIMATION" && (
          <div className="ft-fade">
            <EstimationSheet
              data={estimationQ.data}
              loading={estimationQ.isLoading}
              search={estimationSearch}
              onSearchChange={setEstimationSearch}
              stickyTop={headerHeight}
            />
          </div>
        )}
      </div>
    </>
  );
}
