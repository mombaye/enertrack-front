// Pilotage Grid — la partie choisie dans la barre latérale s'affiche à droite. Sections natives (React + calculs serveur) ; les autres
// utilisent provisoirement l'interface d'origine alimentée par la base.
import { useCallback, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, Upload } from "lucide-react";
import { exportPgBase, getPgFacets, listPgDatasets, pgApiError, type PgFilterState } from "@/services/pilotageGrid";
import { LegacyFrame } from "./LegacyFrame";
import { PgFilterBar } from "./PgFilterBar";
import { PilotageImportModal } from "./PilotageImportModal";
import { StateBox } from "./PgUi";
import { DATASET_KEYS, DATASET_LABELS, PG_SECTIONS, type PgDatasetKey } from "./sections";
import { PaiementsSection } from "./sections/PaiementsSection";
import { SyntheseSection } from "./sections/SyntheseSection";

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "1px solid #D3DCD9", background: "#fff", fontSize: 12.5, fontWeight: 800, color: "#16262E", cursor: "pointer" } as const;
const FILTER_KEYS: Array<keyof PgFilterState> = ["region", "porteur", "tarif", "tension", "from", "to"];
// Parties où la barre de filtres s'applique (comme dans l'interface d'origine).
const WITH_FILTERS = new Set(["syn", "pay", "sit", "fic", "gap", "ctr"]);

export default function PilotageGridPage() {
  const { section: slug } = useParams();
  const section = PG_SECTIONS.find((s) => s.slug === slug);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<PgDatasetKey | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const metaQ = useQuery({ queryKey: ["pg-datasets"], queryFn: listPgDatasets, staleTime: 30_000 });
  const metas = metaQ.data?.datasets ?? [];
  const missing = DATASET_KEYS.filter((k) => metaQ.data && !metas.find((m) => m.key === k)?.disponible);
  const facetsQ = useQuery({ queryKey: ["pg-facets", metas.map((m) => m.version).join(".")], queryFn: getPgFacets, enabled: !!metaQ.data && missing.length === 0, staleTime: 60_000 });

  const filters: PgFilterState = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined])) as PgFilterState, [params]);
  const setFilters = useCallback((v: PgFilterState) => {
    const next = new URLSearchParams(params);
    FILTER_KEYS.forEach((k) => (v[k] ? next.set(k, v[k] as string) : next.delete(k)));
    setParams(next, { replace: true });
  }, [params, setParams]);

  const lastUpdate = useMemo(() => {
    const dates = metas.filter((m) => m.disponible && m.created_at).map((m) => m.created_at as string).sort();
    return dates.length ? new Date(dates[dates.length - 1]).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : null;
  }, [metas]);

  if (!section) return <Navigate to="/pilotage-grid/synthese" replace />;

  const openSite = (siteKey: string) => navigate(`/pilotage-grid/fiche-site?site=${encodeURIComponent(siteKey)}`);
  const refreshAll = () => { qc.invalidateQueries(); };
  const ready = !!metaQ.data && missing.length === 0;

  let content;
  if (!ready) content = null;
  else if (section.tab === "syn") content = <SyntheseSection filters={filters} onOpenSite={openSite} />;
  else if (section.tab === "pay") content = <PaiementsSection filters={filters} onOpenSite={openSite} />;
  else content = <LegacyFrame metas={metas} tab={section.tab} siteKey={params.get("site")} />;

  const native = section.tab === "syn" || section.tab === "pay";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 40px)", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Database size={18} color="#1E5B8E" aria-hidden />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#16262E" }}>Pilotage Grid — {section.label}</h1>
        </div>
        <span style={{ fontSize: 12, color: "#5A6B73" }}>
          {metaQ.isLoading ? "Chargement…" : lastUpdate ? `Données en base — dernière mise à jour : ${lastUpdate}` : "Aucune donnée en base"}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={() => setModal(section.datasets[0])} title="Importer un fichier pour mettre à jour les données, voir l'historique">
          <Upload size={14} aria-hidden /> Importer / mettre à jour
        </button>
        <button type="button" style={btn} disabled={!metas.some((m) => m.disponible)} title="Télécharger toute la base utilisée (zip JSON + manifeste)"
          onClick={() => exportPgBase().then((n) => setExportMsg(`${n} téléchargé.`)).catch((e) => setExportMsg(pgApiError(e)))}>
          <Download size={14} aria-hidden /> Exporter la base
        </button>
      </div>
      {exportMsg && <div role="status" style={{ fontSize: 12, color: "#5A6B73" }}>{exportMsg}</div>}
      {metaQ.isError && <StateBox kind="error">Impossible de charger l'état des données ({pgApiError(metaQ.error)}).</StateBox>}

      {missing.length > 0 && (
        <div role="alert" style={{ padding: 14, borderRadius: 10, background: "#FFF6E9", border: "1px solid rgba(208,138,30,.4)", display: "grid", gap: 8 }}>
          <strong>Données initiales à importer</strong>
          <span style={{ fontSize: 13 }}>Jeux absents de la base : {missing.map((k) => DATASET_LABELS[k]).join(" · ")}.</span>
          {metaQ.data?.can_import
            ? <button type="button" style={{ ...btn, justifySelf: "start" }} onClick={() => setModal(missing[0])}><Upload size={14} aria-hidden /> Importer le fichier initial</button>
            : <span style={{ fontSize: 12.5 }}>Demandez à un admin ou manager d'importer les fichiers initiaux.</span>}
        </div>
      )}

      {ready && native && WITH_FILTERS.has(section.tab) && <PgFilterBar facets={facetsQ.data} value={filters} onChange={setFilters} />}
      {content}

      {modal && <PilotageImportModal metas={metas} canImport={!!metaQ.data?.can_import} defaultKey={modal} onClose={() => setModal(null)} onChanged={refreshAll} />}
    </div>
  );
}
