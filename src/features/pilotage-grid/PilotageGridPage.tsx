// Pilotage Grid — la partie choisie dans la barre latérale s'affiche à droite (interface d'origine alimentée par la base).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, Upload } from "lucide-react";
import { exportPgBase, getPgDataset, listPgDatasets, pgApiError } from "@/services/pilotageGrid";
import { PilotageImportModal } from "./PilotageImportModal";
import { DATASET_KEYS, DATASET_LABELS, PG_SECTIONS, type PgDatasetKey } from "./sections";

const FRAME_SRC = "/pilotage-app/index.html";

const btn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "1px solid #D3DCD9", background: "#fff", fontSize: 12.5, fontWeight: 800, color: "#16262E", cursor: "pointer" } as const;

export default function PilotageGridPage() {
  const { section: slug } = useParams();
  const section = PG_SECTIONS.find((s) => s.slug === slug);
  const qc = useQueryClient();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [modal, setModal] = useState<PgDatasetKeyOrNull>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const sentSignature = useRef<string | null>(null);

  const metaQ = useQuery({ queryKey: ["pg-datasets"], queryFn: listPgDatasets, staleTime: 30_000 });
  const metas = metaQ.data?.datasets ?? [];
  const versionOf = (k: PgDatasetKey) => metas.find((m) => m.key === k)?.version ?? 0;
  const missing = DATASET_KEYS.filter((k) => metaQ.data && !metas.find((m) => m.key === k)?.disponible);

  const dataQs = useQueries({
    queries: DATASET_KEYS.map((k) => ({
      queryKey: ["pg-dataset", k, versionOf(k)],
      queryFn: () => getPgDataset(k),
      enabled: !!metaQ.data && !missing.includes(k),
      staleTime: Infinity,
      gcTime: 30 * 60_000,
      retry: 1,
    })),
  });
  const allLoaded = !!metaQ.data && missing.length === 0 && dataQs.every((q) => q.isSuccess);
  const loadError = dataQs.find((q) => q.isError);
  const signature = DATASET_KEYS.map((k) => `${k}:${versionOf(k)}`).join("|");

  // Réception des messages de l'interface (prête / démarrée / erreur).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const t = (e.data as { type?: string })?.type;
      if (t === "pg:ready") setReady(true);
      if (t === "pg:started") setStarted(true);
      if (t === "pg:error") setFrameError(String((e.data as { message?: string }).message ?? "erreur"));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Envoi des données dès que l'interface est prête ; si une mise à jour change les données, l'interface est rechargée.
  useEffect(() => {
    if (!ready || !allLoaded) return;
    if (sentSignature.current === signature) return;
    if (sentSignature.current !== null) {
      sentSignature.current = null;
      setReady(false); setStarted(false); setFrameKey((k) => k + 1);
      return;
    }
    const data = Object.fromEntries(DATASET_KEYS.map((k, i) => [k, dataQs[i].data]));
    frameRef.current?.contentWindow?.postMessage({ type: "pg:data", data }, window.location.origin);
    sentSignature.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, allLoaded, signature]);

  // Section affichée : à chaque clic dans la barre latérale.
  useEffect(() => {
    if (!ready || !section) return;
    frameRef.current?.contentWindow?.postMessage({ type: "pg:section", id: section.tab }, window.location.origin);
  }, [ready, started, section]);

  const refreshAll = useCallback(() => { qc.invalidateQueries({ queryKey: ["pg-datasets"] }); }, [qc]);

  const lastUpdate = useMemo(() => {
    const dates = metas.filter((m) => m.disponible && m.created_at).map((m) => m.created_at as string).sort();
    return dates.length ? new Date(dates[dates.length - 1]).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : null;
  }, [metas]);

  if (!section) return <Navigate to="/pilotage-grid/synthese" replace />;

  const defaultKey: PgDatasetKey = section.datasets[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 40px)", minHeight: 520, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Database size={18} color="#1E5B8E" aria-hidden />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#16262E" }}>Pilotage Grid — {section.label}</h1>
        </div>
        <span style={{ fontSize: 12, color: "#5A6B73" }}>
          {metaQ.isLoading ? "Chargement…" : lastUpdate ? `Données en base — dernière mise à jour : ${lastUpdate}` : "Aucune donnée en base"}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={() => setModal(defaultKey)} title="Importer un fichier pour mettre à jour les données, voir l'historique">
          <Upload size={14} aria-hidden /> Importer / mettre à jour
        </button>
        <button type="button" style={btn} disabled={!metas.some((m) => m.disponible)} title="Télécharger toute la base utilisée (zip JSON + manifeste)"
          onClick={() => exportPgBase().then((n) => setExportMsg(`${n} téléchargé.`)).catch((e) => setExportMsg(pgApiError(e)))}>
          <Download size={14} aria-hidden /> Exporter la base
        </button>
      </div>
      {exportMsg && <div role="status" style={{ fontSize: 12, color: "#5A6B73" }}>{exportMsg}</div>}

      {metaQ.isError && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FBEAEE", color: "#B0425A", fontWeight: 700 }}>Impossible de charger l'état des données ({pgApiError(metaQ.error)}).</div>}

      {missing.length > 0 && (
        <div role="alert" style={{ padding: 14, borderRadius: 10, background: "#FFF6E9", border: "1px solid rgba(208,138,30,.4)", display: "grid", gap: 8 }}>
          <strong>Données initiales à importer</strong>
          <span style={{ fontSize: 13 }}>Jeux absents de la base : {missing.map((k) => DATASET_LABELS[k]).join(" · ")}.</span>
          {metaQ.data?.can_import
            ? <button type="button" style={{ ...btn, justifySelf: "start" }} onClick={() => setModal(missing[0])}><Upload size={14} aria-hidden /> Importer le fichier initial</button>
            : <span style={{ fontSize: 12.5 }}>Demandez à un admin ou manager d'importer les fichiers initiaux.</span>}
        </div>
      )}
      {loadError && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FBEAEE", color: "#B0425A", fontWeight: 700 }}>Chargement des données impossible ({pgApiError(loadError.error)}).</div>}
      {frameError && <div role="alert" style={{ padding: 12, borderRadius: 10, background: "#FBEAEE", color: "#B0425A", fontWeight: 700 }}>Erreur d'affichage : {frameError}</div>}
      {allLoaded && !started && !frameError && <div role="status" style={{ fontSize: 13, color: "#5A6B73" }}>Préparation de l'affichage…</div>}
      {!allLoaded && missing.length === 0 && !loadError && !metaQ.isError && <div role="status" style={{ fontSize: 13, color: "#5A6B73" }}>Chargement des données depuis la base…</div>}

      <iframe
        key={frameKey}
        ref={frameRef}
        title={`Pilotage Grid — ${section.label}`}
        src={FRAME_SRC}
        style={{ flex: 1, width: "100%", border: "1px solid #D3DCD9", borderRadius: 12, background: "#EEF2F1", display: allLoaded ? "block" : "none" }}
      />

      {modal && (
        <PilotageImportModal
          metas={metas}
          canImport={!!metaQ.data?.can_import}
          defaultKey={modal}
          onClose={() => setModal(null)}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}

type PgDatasetKeyOrNull = PgDatasetKey | null;
