// Version provisoire des sections pas encore portées en React natif : interface d'origine alimentée par la base (iframe).
import { useEffect, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { getPgDataset, pgApiError, type PgDatasetMeta } from "@/services/pilotageGrid";
import { DATASET_KEYS, type PgDatasetKey } from "./sections";

const FRAME_SRC = "/pilotage-app/index.html";

export function LegacyFrame({ metas, tab, siteKey }: { metas: PgDatasetMeta[]; tab: string; siteKey?: string | null }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);
  const versionOf = (k: PgDatasetKey) => metas.find((m) => m.key === k)?.version ?? 0;

  const qs = useQueries({
    queries: DATASET_KEYS.map((k) => ({
      queryKey: ["pg-dataset", k, versionOf(k)],
      queryFn: () => getPgDataset(k),
      enabled: metas.some((m) => m.key === k && m.disponible),
      staleTime: Infinity, gcTime: 30 * 60_000, retry: 1,
    })),
  });
  const loaded = qs.every((q) => q.isSuccess);
  const failed = qs.find((q) => q.isError);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const t = (e.data as { type?: string })?.type;
      if (t === "pg:ready") setReady(true);
      if (t === "pg:started") setStarted(true);
      if (t === "pg:error") setError(String((e.data as { message?: string }).message ?? "erreur"));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (!ready || !loaded || sent.current) return;
    const data = Object.fromEntries(DATASET_KEYS.map((k, i) => [k, qs[i].data]));
    frameRef.current?.contentWindow?.postMessage({ type: "pg:data", data }, window.location.origin);
    sent.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loaded]);

  useEffect(() => {
    if (!started) return;
    const w = frameRef.current?.contentWindow;
    w?.postMessage({ type: "pg:section", id: tab }, window.location.origin);
    if (siteKey) w?.postMessage({ type: "pg:site", id: siteKey }, window.location.origin);
  }, [started, tab, siteKey]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 480, gap: 8 }}>
      {failed && <div role="alert" style={{ color: "#B0425A", fontWeight: 700 }}>Chargement impossible ({pgApiError(failed.error)}).</div>}
      {error && <div role="alert" style={{ color: "#B0425A", fontWeight: 700 }}>Erreur d'affichage : {error}</div>}
      {!started && !failed && !error && <div role="status" style={{ fontSize: 13, color: "#5A6B73" }}>Chargement des données depuis la base…</div>}
      <iframe ref={frameRef} title="Pilotage Grid" src={FRAME_SRC}
        style={{ flex: 1, width: "100%", minHeight: "calc(100vh - 130px)", border: "none", borderRadius: 0, background: "#FFFFFF", display: loaded ? "block" : "none" }} />
    </div>
  );
}
