// src/features/fuel-tracking/sheets/StockWorkQueue.tsx
// « À traiter — actions requises » : compteurs cliquables ; chaque liste dit quelle donnée est en
// anomalie, quelle règle a échoué et quelle action faire (jamais un simple « à valider »).

import { useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Search } from "lucide-react";
import { getStockWorkQueue, getStockWorkQueueCounters, type WorkQueueItem } from "@/services/fuelTracking";
import { Card, EmptyState, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, fmtDateTime, tdStyle, thStyle } from "./stockRegistryUi";

export type QueueTarget = { siteId: string; tab?: "RELEVES" | "MOUVEMENTS" | "CUVES" };

const cell: CSSProperties = { ...tdStyle, textAlign: "left", whiteSpace: "normal", verticalAlign: "top", padding: "10px 12px" };

const ACTION_BUTTON: Record<WorkQueueItem["action_type"], string> = {
  OPEN_TANK: "Traiter la cuve",
  OPEN_HISTORY: "Ouvrir",
  VALIDATE_OBS: "Valider / rejeter",
  SET_GUARD: "Gardiennage",
  MAP_ENOC: "Classifier",
};

export function StockWorkQueue({ onOpen, onMapEnoc }: { onOpen: (t: QueueTarget) => void; onMapEnoc: (raw: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const counters = useQuery({ queryKey: ["stock-queue-counters"], queryFn: getStockWorkQueueCounters });
  const list = useQuery({
    queryKey: ["stock-queue", selected, page, search],
    queryFn: () => getStockWorkQueue(selected!, { page, limit: 25, search }),
    enabled: !!selected,
    placeholderData: (p) => p,
  });
  useEffect(() => setPage(1), [selected, search]);
  // Ouvre directement la première catégorie non vide : pas de clic inutile pour voir quoi faire.
  useEffect(() => {
    if (selected === null && counters.data) {
      const first = counters.data.counters.find((c) => c.count > 0);
      if (first) setSelected(first.key);
    }
  }, [counters.data, selected]);
  const nonEmpty = (counters.data?.counters ?? []).filter((c) => c.count > 0);
  const empty = (counters.data?.counters ?? []).filter((c) => c.count === 0);

  const act = (it: WorkQueueItem) => {
    if (it.action_type === "MAP_ENOC" && it.ref.raw_value) return onMapEnoc(it.ref.raw_value);
    const tab = it.action_type === "OPEN_TANK" || it.action_type === "SET_GUARD" ? "CUVES" : it.ref.movement_id ? "MOUVEMENTS" : "RELEVES";
    onOpen({ siteId: it.site_id, tab });
  };

  const total = (counters.data?.counters ?? []).reduce((a, c) => a + c.count, 0);

  return (
    <Card>
      <SheetTitle
        icon={<ListChecks size={17} />}
        title="À traiter — actions requises"
        subtitle={counters.data ? `${total.toLocaleString("fr-FR")} élément(s) à traiter. Chaque ligne indique l'anomalie et l'action à faire.` : "Chargement des anomalies…"}
      />
      {counters.isLoading && <Skeleton h={90} />}
      {counters.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Compteurs indisponibles.</div>}
      {counters.data && (
        <div role="tablist" aria-label="Catégories à traiter" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginTop: 12 }}>
          {nonEmpty.map((c) => {
            const active = selected === c.key;
            const tone = c.count === 0 ? FT.textSub : active ? "#fff" : FT.text;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={c.description}
                onClick={() => setSelected(c.key)}
                style={{
                  textAlign: "left", borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                  border: `1px solid ${active ? FT.navy : FT.border}`, background: active ? FT.navy : c.count ? FT.orangeL : FT.slateL,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: active ? "#fff" : c.count ? FT.orange : FT.textSub, fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {c.count.toLocaleString("fr-FR")}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: tone, marginTop: 2 }}>{c.label}</div>
              </button>
            );
          })}
        </div>
      )}
      {counters.data && empty.length > 0 && (
        <div style={{ fontSize: 11.5, color: FT.textSub, marginTop: 8 }}>
          Rien à traiter : {empty.map((c) => c.label.toLowerCase()).join(" · ")}.
        </div>
      )}
      {counters.data && nonEmpty.length === 0 && (
        <EmptyState icon={<ListChecks size={20} />} title="Tout est à jour" subtitle="Aucune anomalie en attente." />
      )}

      {selected && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: FT.text }}>
              {list.data?.label ?? "…"} — {counters.data?.counters.find((c) => c.key === selected)?.description}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${FT.border}`, background: FT.slateL, borderRadius: 9, padding: "0 10px", height: 30 }}>
              <Search size={13} color={FT.textSub} aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Site ID…" aria-label="Filtrer la liste par site"
                     style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, width: 140 }} />
            </div>
          </div>
          {list.isLoading && <Skeleton h={200} />}
          {list.data && list.data.data.length === 0 && <EmptyState icon={<ListChecks size={20} />} title="Rien à traiter dans cette catégorie" />}
          {list.data && list.data.data.length > 0 && (
            <>
              <div style={{ overflow: "auto", maxHeight: 460, borderRadius: 10, border: `1px solid ${FT.border}`, opacity: list.isFetching ? 0.7 : 1 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980 }}>
                  <caption style={{ position: "absolute", left: -9999 }}>{list.data.label}</caption>
                  <thead>
                    <tr>
                      {["Site", "Problème", "Pourquoi", "Que faire ?", ""].map((h, i) => (
                        <th key={i} scope="col" style={{ ...thStyle, textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((it, i) => (
                      <tr key={`${it.site_id}-${i}`} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                        <th scope="row" style={{ ...cell, minWidth: 120 }}>
                          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 800 }}>{it.site_id}</div>
                          <div style={{ fontSize: 11, color: FT.textSub, fontWeight: 500 }}>{it.source} · {fmtDateTime(it.date) ?? "—"}</div>
                        </th>
                        <td style={{ ...cell, minWidth: 240 }}>
                          <div style={{ fontWeight: 700, color: FT.orange }}>{it.anomalie}{it.count > 1 ? ` (${it.count} relevés)` : ""}</div>
                          <div style={{ fontSize: 11.5, color: FT.textMid }}>{it.valeur_brute}</div>
                        </td>
                        <td style={{ ...cell, minWidth: 220, fontSize: 11.5, color: FT.textMid }}>
                          <div>{it.regle}</div>
                          <div style={{ color: FT.textSub }}>Attendu : {it.attendu}</div>
                        </td>
                        <td style={{ ...cell, minWidth: 220, fontWeight: 700 }}>{it.action}</td>
                        <td style={{ ...cell, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            {list.data.can_validate ? (
                              <button type="button" style={actionBtn("violet")} onClick={() => act(it)}>{ACTION_BUTTON[it.action_type]}</button>
                            ) : (
                              <span style={{ color: FT.textSub, fontSize: 11 }} title="Réservé aux rôles admin et manager">lecture seule</span>
                            )}
                            <button type="button" style={actionBtn("blue")} onClick={() => onOpen({ siteId: it.site_id })} aria-label={`Historique ${it.site_id}`}>
                              Détail
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                page={list.data.pagination.page}
                totalPages={list.data.pagination.totalPages}
                hasPrev={list.data.pagination.hasPrev}
                hasNext={list.data.pagination.hasNext}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            </>
          )}
        </div>
      )}
    </Card>
  );
}
