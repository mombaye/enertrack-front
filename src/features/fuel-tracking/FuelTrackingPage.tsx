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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, Calculator, Calendar, Droplets, Fuel, Gauge, LayoutGrid, RefreshCw, Warehouse } from "lucide-react";

import {
  getFuelCommandeEstimation,
  getFuelCommandes,
  getFuelConsommation,
  getFuelConsommationDashboard,
  getFuelStock,
  type FuelSourceStatus,
} from "@/services/fuelTracking";

import { FT } from "./theme";
import { GLOBAL_STYLES } from "./ui";
import { ConsommationSheet } from "./sheets/ConsommationSheet";
import { DashboardSheet } from "./sheets/DashboardSheet";
import { StockSheet } from "./sheets/StockSheet";
import { CommandeSheet } from "./sheets/CommandeSheet";
import { EstimationSheet } from "./sheets/EstimationSheet";
import { ControleCphSheet } from "./sheets/ControleCphSheet";

export type MainTab = "DASHBOARD" | "CONSOMMATION" | "CPH" | "STOCK" | "COMMANDE" | "ESTIMATION";

export const FUEL_TAB_SLUGS: Array<{ tab: MainTab; slug: string }> = [
  { tab: "DASHBOARD", slug: "dashboard" },
  { tab: "CONSOMMATION", slug: "consommations" },
  { tab: "CPH", slug: "controle-cph" },
  { tab: "STOCK", slug: "stock" },
  { tab: "COMMANDE", slug: "commandes" },
  { tab: "ESTIMATION", slug: "estimation-commande" },
];
const TAB_BY_SLUG: Record<string, MainTab> = Object.fromEntries(FUEL_TAB_SLUGS.map((x) => [x.slug, x.tab]));
const SLUG_BY_TAB = Object.fromEntries(FUEL_TAB_SLUGS.map((x) => [x.tab, x.slug])) as Record<MainTab, string>;

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

/** Mois calendaire courant (ex: "2026-09") — plafond du sélecteur "à" :
 * le mois en cours reste sélectionnable manuellement (utile dès que des
 * données commencent à y apparaître), seul le DÉFAUT au premier chargement
 * reste plafonné à M-1 (voir previousCalendarMonth) pour ne pas donner
 * l'impression trompeuse d'une panne sur un mois qui vient de commencer. */
function currentCalendarMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  const qc = useQueryClient();
  // L'onglet actif vient de l'adresse (sous-rubriques de la barre latérale : /modules/suivi-carburant/<onglet>).
  const { tab: tabSlug } = useParams();
  const navigate = useNavigate();
  const activeTab: MainTab = TAB_BY_SLUG[tabSlug ?? ""] ?? "DASHBOARD";
  const setActiveTab = (t: MainTab) => {
    navigate(`/modules/suivi-carburant/${SLUG_BY_TAB[t]}`);
    window.scrollTo({ top: 0 });
  };
  // Le header pilote une PLAGE de 2 mois (pas un mois unique) — sert
  // directement le Dashboard (tendance) ; l'onglet Suivis Consommations
  // (tableau site×mois) utilise le mois le plus récent de cette plage
  // (`toMonth`). Initialisée automatiquement aux 3 derniers mois disponibles
  // dès la 1ère réponse du Dashboard (voir useEffect plus bas).
  const [fromMonth, setFromMonth] = useState<string | null>(null);
  const [toMonth, setToMonth] = useState<string | null>(null);
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
  // Suivis Consommations n'affiche plus le tableau mensuel paginé : seuls les
  // indicateurs du mois (sites Avec GE), la détection GE et le statut des sources
  // sont lus ici (1 ligne suffit). Le tableau unique est servi par /cph/.
  const consommationQ = useQuery({
    queryKey: ["fuel-consommation", toMonth],
    queryFn: () => getFuelConsommation({
      month: toMonth ?? undefined,
      page: 1,
      limit: 1,
      has_genset: "true",
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
    // Aussi actif sur DASHBOARD : la section Estimation du Dashboard
    // réutilise cette même requête (pas de duplication d'appel réseau).
    enabled: activeTab === "ESTIMATION" || activeTab === "DASHBOARD",
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

  // Date de la DONNÉE la plus récente réellement disponible côté source
  // (pas l'heure d'exécution de la synchro, qui ne dit rien sur la
  // fraîcheur réelle) — affichée au centre du header pour repérer une
  // source en retard même quand la synchro elle-même tourne et "réussit"
  // normalement (ex: coupure de Snowflake GFMS_DATA_TRACKER_NC repérée le
  // 2026-09 : dernière ligne le 20/08 alors que la synchro tournait bien
  // tous les jours — sans cette date, ça ressemble à un bug EnerTrack).
  const sources = consommationQ.data?.sources;
  // Les faits Snowflake sont agrégés au jour — pas d'heure dans la source elle-même,
  // afficher une heure inventée (00:00) serait trompeur sur la précision réelle.
  const formatDataDateOnly = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "long" }) : "—";
  // ENOC (mouvement de ravitaillement) a une vraie date ET heure d'opération.
  const formatDataDateTime = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "medium" }) : "—";
  const snowflakeLastDataLabel = formatDataDateOnly(sources?.snowflake?.last_data_date);
  const enocLastDataLabel = formatDataDateTime(sources?.enoc?.last_data_date);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="fuelbook" style={{ display: "flex", flexDirection: "column", gap: 14, background: FT.pageBg, margin: -20, padding: 20 }}>
        <div
          ref={headerRef}
          className="ft-fade"
          style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", border: `1px solid ${FT.border}`, borderRadius: FT.radius, boxShadow: FT.shadow, padding: "10px 16px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: FT.blueL, display: "grid", placeItems: "center", color: FT.gold, flexShrink: 0 }}>
                <BarChart3 size={15} aria-hidden />
              </div>
              <h1 style={{ margin: 0, color: "#0f172a", fontSize: 18, lineHeight: 1.2, fontWeight: 900, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>Suivi Carburant</h1>
              <SourceBadge label="Snowflake" status={consommationQ.data?.sources?.snowflake} />
              <SourceBadge label="ENOC" status={consommationQ.data?.sources?.enoc} />
            </div>

            <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: FT.textSub, flexWrap: "wrap" }}>
              <span><strong style={{ color: FT.text }}>Snowflake</strong> : {snowflakeLastDataLabel}</span>
              <span><strong style={{ color: FT.text }}>ENOC</strong> : {enocLastDataLabel}</span>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {(activeTab === "DASHBOARD" || activeTab === "CONSOMMATION") && (
                <div title="Mois des indicateurs mensuels (tendance du Dashboard, couverture GE)" style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "5px 10px" }}>
                  <Calendar size={14} color={FT.textSub} aria-hidden />
                  <input
                    aria-label="Mois de début"
                    type="month"
                    value={fromMonth ?? ""}
                    max={toMonth ?? undefined}
                    onChange={(e) => setFromMonth(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 }}
                  />
                  <span style={{ color: FT.textSub, fontSize: 12 }}>à</span>
                  <input
                    aria-label="Mois de fin"
                    type="month"
                    value={toMonth ?? ""}
                    min={fromMonth ?? undefined}
                    max={currentCalendarMonth()}
                    onChange={(e) => setToMonth(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: FT.text, fontWeight: 700 }}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => { consommationQ.refetch(); qc.invalidateQueries(); }}
                title="Rafraîchir toutes les données"
                aria-label="Rafraîchir"
                style={{ width: 31, height: 31, borderRadius: 9, border: `1px solid ${FT.border}`, background: FT.slateL, display: "grid", placeItems: "center", cursor: "pointer", color: FT.textMid, flexShrink: 0 }}
              >
                <RefreshCw size={14} className={consommationQ.isFetching ? "ft-spin" : ""} aria-hidden />
              </button>
            </div>
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
              estimationData={estimationQ.data}
              estimationLoading={estimationQ.isLoading}
              onNavigateTab={setActiveTab}
            />
          </div>
        )}

        {activeTab === "CONSOMMATION" && (
          <div className="ft-fade">
            <ConsommationSheet
              data={consommationQ.data}
              loading={consommationQ.isLoading}
              stickyTop={headerHeight}
            />
          </div>
        )}

        {activeTab === "CPH" && (
          <div className="ft-fade">
            <ControleCphSheet />
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
