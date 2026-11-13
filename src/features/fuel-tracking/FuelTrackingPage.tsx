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
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BarChart3, Calculator, Calendar, Droplets, Fuel, Gauge, LayoutGrid, RefreshCw, Warehouse, Bell } from "lucide-react";

import {
  getFuelCommandeEstimation,
  getFuelCommandes,
  getFuelConsommation,
  getFuelConsommationDashboard,
  getFuelStock,
  getSiteTable,
  type FuelSourceStatus,
} from "@/services/fuelTracking";

import { FT } from "./theme";
import { GLOBAL_STYLES } from "./ui";
import { SHELL_CSS } from "./shellStyles";
import { ConsoBi } from "./bi/ConsoBi";
import { CphBi } from "./bi/CphBi";
import { StockBi } from "./bi/StockBi";
import { RavitaillementBi } from "./bi/RavitaillementBi";
import { SitesTableBi } from "./bi/SitesTableBi";
import { CommandeBi, EstimationBi } from "./bi/CommandeBi";
import { DetailSection, OpenSiteContext, SectionTitle } from "./bi/kit";
import { SiteBi } from "./bi/SiteBi";
import { SiteSearch } from "./bi/SiteSearch";
import { StockSheet } from "./sheets/StockSheet";
import { CommandeSheet } from "./sheets/CommandeSheet";
import { EstimationSheet } from "./sheets/EstimationSheet";
import { ControleCphSheet } from "./sheets/ControleCphSheet";
import { ConfigurationSheet } from "./sheets/ConfigurationSheet";
import { DashboardBi } from "./bi/DashboardBi";
import { AlertesBi, useAlertes } from "./bi/AlertesBi";
import { RemonteesBi } from "./bi/RemonteesBi";

export type MainTab = "DASHBOARD" | "ALERTES" | "REMONTEES" | "CONSOMMATION" | "CPH" | "STOCK" | "RAVITAILLEMENT" | "COMMANDE" | "ESTIMATION" | "CONFIGURATION";

export const FUEL_TAB_SLUGS: Array<{ tab: MainTab; slug: string }> = [
  { tab: "DASHBOARD", slug: "dashboard" },
  { tab: "CONSOMMATION", slug: "consommations" },
  { tab: "CPH", slug: "controle-cph" },
  { tab: "STOCK", slug: "stock" },
  { tab: "RAVITAILLEMENT", slug: "ravitaillement" },
  { tab: "ALERTES", slug: "alertes" },
  { tab: "REMONTEES", slug: "remontees-terrain" },
  { tab: "COMMANDE", slug: "commandes" },
  { tab: "ESTIMATION", slug: "estimation-commande" },
  { tab: "CONFIGURATION", slug: "configuration" },
];
// « donnees-par-site » : ancienne rubrique, son contenu est maintenant dans Suivi Conso et Suivi Stock.
const TAB_BY_SLUG: Record<string, MainTab> = { ...Object.fromEntries(FUEL_TAB_SLUGS.map((x) => [x.slug, x.tab])), "donnees-par-site": "CONSOMMATION" };
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
  // Fiche site : ?site=<id> dans l'adresse (lien partageable, bouton Retour du navigateur).
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = searchParams.get("site");
  // Suivi Conso : choisir un site dans la recherche filtre la page (KPIs et tableau) au lieu d'ouvrir la fiche du site.
  const [consoSite, setConsoSite] = useState("");
  // Région (zone) : filtre global du bandeau, appliqué à Suivi Conso, Suivi Stock, Ravitaillement et Contrôle CPH.
  const [zone, setZone] = useState("");
  const openSite = (id: string) => { setSearchParams((p) => { const n = new URLSearchParams(p); n.set("site", id); return n; }); window.scrollTo({ top: 0 }); };
  const closeSite = () => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete("site"); return n; });
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
    enabled: activeTab === "STOCK",
    staleTime: 60_000,
  });

  const commandeQ = useQuery({
    queryKey: ["fuel-commandes", commandeSearch, commandePage],
    queryFn: () => getFuelCommandes({
      search: commandeSearch,
      page: commandePage,
      limit: 50,
    }),
    enabled: activeTab === "COMMANDE",
    staleTime: 60_000,
  });

  // Liste des régions et nombre de sites GE du mois (bandeau de filtres).
  const zonesQ = useQuery({
    queryKey: ["fuel-zones", toMonth, zone],
    queryFn: () => getSiteTable({ vue: "conso", month: toMonth ?? undefined, zone: zone || undefined, page_size: "10" }),
    enabled: !!toMonth,
    staleTime: 5 * 60_000,
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

  // Barre d'onglets de la maquette ; Commande et Estimation sont gardées en fin de barre (fonctions existantes).
  const TABS: Array<{ tab: MainTab; label: string }> = [
    { tab: "DASHBOARD", label: "Dashboard" }, { tab: "CONSOMMATION", label: "Suivi Conso" }, { tab: "STOCK", label: "Suivi Stock" }, { tab: "RAVITAILLEMENT", label: "Ravitaillement" },
    { tab: "CPH", label: "Contrôle CPH" }, { tab: "ALERTES", label: "Alertes" }, { tab: "REMONTEES", label: "Remontées terrain" }, { tab: "CONFIGURATION", label: "Configuration" }, { tab: "COMMANDE", label: "Commande" }, { tab: "ESTIMATION", label: "Estimation" },
  ];
  // Compteur de la cloche : alertes critiques du mois et de la région (même requête que la page Alertes).
  const alertesQ = useAlertes(toMonth, zone);
  const nbCrit = (alertesQ.data?.alertes ?? []).filter((a) => a.sev === "crit").length;
  const srcFail = [sources?.snowflake, sources?.enoc].filter((x) => x && !x.connected).length;
  const showPeriod = !!siteId || (activeTab !== "COMMANDE" && activeTab !== "ESTIMATION" && activeTab !== "CONFIGURATION" && activeTab !== "REMONTEES");
  const showZone = !siteId && ["DASHBOARD", "ALERTES", "CONSOMMATION", "STOCK", "RAVITAILLEMENT", "CPH"].includes(activeTab);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <style>{SHELL_CSS}</style>

      <div className="fuelbook ftm" style={{ display: "flex", flexDirection: "column", background: "#fff", margin: -20 }}>
        <header ref={headerRef} className="ftm-top">
          <div className="ftm-row1">
            <div className="ftm-logo" aria-hidden>C</div>
            <h1>Suivi Carburant · Sénégal</h1>
            <span className="ftm-live" title={[sources?.snowflake?.error && `Snowflake : ${sources.snowflake.error}`, sources?.enoc?.error && `ENOC : ${sources.enoc.error}`].filter(Boolean).join("\n") || "Date de la donnée la plus récente de chaque source"}>
              <span className="ftm-pulse" data-state={srcFail ? "warn" : "ok"} aria-hidden />
              Snowflake : {snowflakeLastDataLabel} · ENOC : {enocLastDataLabel}{srcFail ? ` · ${srcFail} source${srcFail > 1 ? "s" : ""} en échec` : ""}
            </span>
            <button type="button" className="ftm-bell" onClick={() => { if (siteId) closeSite(); setActiveTab("ALERTES"); }}
              aria-label={`Voir les alertes${nbCrit ? ` : ${nbCrit} critiques` : ""}`}>
              <Bell size={15} aria-hidden /> Alertes {alertesQ.data && <span className="ftm-badge" title="Alertes critiques">{nbCrit.toLocaleString("fr-FR")}</span>}
            </button>
            <button type="button" className="ftm-icon" onClick={() => { consommationQ.refetch(); qc.invalidateQueries(); }} title="Rafraîchir toutes les données" aria-label="Rafraîchir">
              <RefreshCw size={15} className={consommationQ.isFetching ? "ft-spin" : ""} aria-hidden />
            </button>
          </div>
          <nav className="ftm-tabs" aria-label="Pages du suivi carburant">
            {TABS.map((t) => (
              <button key={t.tab} type="button" aria-current={!siteId && activeTab === t.tab ? "page" : undefined}
                onClick={() => { if (siteId) closeSite(); setActiveTab(t.tab); }}>{t.label}
                {t.tab === "ALERTES" && nbCrit > 0 && <span className="ftm-cnt" aria-label={`${nbCrit} critiques`}>{nbCrit.toLocaleString("fr-FR")}</span>}</button>
            ))}
          </nav>
        </header>

        <div className="ftm-slicers" role="group" aria-label="Filtres appliqués aux pages">
          <SiteSearch onSelect={(id) => (!siteId && activeTab === "CONSOMMATION" ? setConsoSite(id) : openSite(id))} />
          {showPeriod && <>
            <label className="ftm-sel"><span>Du</span>
              <input type="month" aria-label="Mois de début" value={fromMonth ?? ""} max={toMonth ?? undefined} onChange={(e) => setFromMonth(e.target.value)} />
            </label>
            <label className="ftm-sel"><span>Au</span>
              <input type="month" aria-label="Mois de fin" value={toMonth ?? ""} min={fromMonth ?? undefined} max={currentCalendarMonth()} onChange={(e) => setToMonth(e.target.value)} />
            </label>
          </>}
          {showZone && (
            <label className="ftm-sel"><span>Région</span>
              <select value={zone} className={zone ? "on" : ""} onChange={(e) => setZone(e.target.value)}>
                <option value="">Toutes les régions</option>
                {(zonesQ.data?.filters.zones ?? []).map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
          )}
          {showZone && zonesQ.data && <span className="ftm-count">{zonesQ.data.total.toLocaleString("fr-FR")} sites GE</span>}
          {(zone || consoSite) && <button type="button" className="ftm-clear" onClick={() => { setZone(""); setConsoSite(""); }}>Réinitialiser</button>}
        </div>

        <div className="ftm-main">
        {siteId && (
          <div className="ft-fade" key={siteId}>
            <SiteBi siteId={siteId} fromMonth={fromMonth} toMonth={toMonth} onClose={closeSite} />
          </div>
        )}

        <OpenSiteContext.Provider value={openSite}>
        {!siteId && activeTab === "DASHBOARD" && (
          <div className="ft-fade">
            <DashboardBi fromMonth={fromMonth} toMonth={toMonth} zone={zone} onTab={setActiveTab} />
          </div>
        )}

        {!siteId && activeTab === "ALERTES" && (
          <div className="ft-fade">
            <AlertesBi toMonth={toMonth} zone={zone} />
          </div>
        )}

        {!siteId && activeTab === "REMONTEES" && (
          <div className="ft-fade">
            <RemonteesBi />
          </div>
        )}

        {!siteId && activeTab === "CONSOMMATION" && (
          <div className="ft-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* KPIs, tableau unique par site et graphiques : tout est dans ConsoBi (mêmes filtres). */}
            <ConsoBi fromMonth={fromMonth} toMonth={toMonth} zone={zone} siteText={consoSite} />
          </div>
        )}

        {!siteId && activeTab === "CPH" && (
          <div className="ft-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CphBi fromMonth={fromMonth} toMonth={toMonth} zone={zone} />
            <DetailSection title="Contrôle CPH détaillé (tableau par site, diagnostics, référentiel)">
              <ControleCphSheet />
            </DetailSection>
          </div>
        )}

        {!siteId && activeTab === "STOCK" && (
          <div className="ft-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <StockBi toMonth={toMonth} zone={zone} />
            <SitesTableBi vue="stock" toMonth={toMonth} zone={zone} />
            <DetailSection title="Stock détaillé (registre, relevés, bilans, imports)">
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
            </DetailSection>
          </div>
        )}

        {!siteId && activeTab === "RAVITAILLEMENT" && (
          <div className="ft-fade">
            <RavitaillementBi toMonth={toMonth} zone={zone} />
          </div>
        )}

        {!siteId && activeTab === "COMMANDE" && (
          <div className="ft-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <CommandeSheet
              overview={<CommandeBi data={commandeQ.data} loading={commandeQ.isLoading} error={commandeQ.isError} />}
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

        {!siteId && activeTab === "ESTIMATION" && (
          <div className="ft-fade" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <EstimationSheet
              overview={<EstimationBi data={estimationQ.data} loading={estimationQ.isLoading} error={estimationQ.isError} />}
              data={estimationQ.data}
              loading={estimationQ.isLoading}
              search={estimationSearch}
              onSearchChange={setEstimationSearch}
              stickyTop={headerHeight}
            />
          </div>
        )}

        {!siteId && activeTab === "CONFIGURATION" && (
          <div className="ft-fade">
            <ConfigurationSheet />
          </div>
        )}
        </OpenSiteContext.Provider>
        </div>
      </div>
    </>
  );
}
