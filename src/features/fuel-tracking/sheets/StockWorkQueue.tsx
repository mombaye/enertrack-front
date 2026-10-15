// src/features/fuel-tracking/sheets/StockWorkQueue.tsx
// « À traiter — actions requises » : compteurs cliquables ; chaque liste dit quelle donnée est en
// anomalie, quelle règle a échoué et quelle action faire (jamais un simple « à valider »).

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Search } from "lucide-react";
import { getStockWorkQueue, getStockWorkQueueCounters, type WorkQueueItem } from "@/services/fuelTracking";
import { Card, EmptyState, Pager, SheetTitle, Skeleton } from "../ui";
import { FT } from "../theme";
import { actionBtn, fmtDateTime, tdStyle, thStyle } from "./stockRegistryUi";

export type QueueTarget = { siteId: string; tab?: "RELEVES" | "MOUVEMENTS" | "CUVES" };

const ACTION_BUTTON: Record<WorkQueueItem["action_type"], string> = {
  OPEN_TANK: "Traiter la cuve",
  OPEN_HISTORY: "Ouvrir",
  VALIDATE_OBS: "Valider / rejeter",
  SET_GUARD: "Affecter le gardiennage",
  MAP_ENOC: "Classifier le type",
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
        subtitle={counters.data ? `${total.toLocaleString("fr-FR")} élément(s) à traiter. Cliquer sur un compteur pour voir la liste et l'action attendue.` : "Chargement des anomalies…"}
      />
      {counters.isLoading && <Skeleton h={90} />}
      {counters.isError && <div role="alert" style={{ color: FT.red, fontSize: 13 }}>Compteurs indisponibles.</div>}
      {counters.data && (
        <div role="tablist" aria-label="Catégories à traiter" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginTop: 12 }}>
          {counters.data.counters.map((c) => {
            const active = selected === c.key;
            const tone = c.count === 0 ? FT.textSub : active ? "#fff" : FT.text;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={active}
                title={c.description}
                onClick={() => setSelected(active ? null : c.key)}
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
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1500 }}>
                  <caption style={{ position: "absolute", left: -9999 }}>{list.data.label}</caption>
                  <thead>
                    <tr>
                      {["Site", "Date", "Source", "Anomalie", "Valeur brute", "Attendu", "Règle échouée", "Action à faire", "Historique", "Action"].map((h) => (
                        <th key={h} scope="col" style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.data.map((it, i) => (
                      <tr key={`${it.site_id}-${i}`} style={{ background: i % 2 ? FT.cardAlt : "#fff" }}>
                        <th scope="row" style={{ ...tdStyle, fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 800 }}>{it.site_id}</th>
                        <td style={tdStyle}>{fmtDateTime(it.date) ?? "—"}</td>
                        <td style={tdStyle}>{it.source}</td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 200, textAlign: "left", fontWeight: 700, color: FT.orange }}>
                          {it.anomalie}{it.count > 1 ? ` (${it.count} relevés)` : ""}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 200, textAlign: "left" }}>{it.valeur_brute}</td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 160, textAlign: "left", color: FT.textMid }}>{it.attendu}</td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 200, textAlign: "left", color: FT.textMid, fontSize: 11.5 }}>{it.regle}</td>
                        <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 220, textAlign: "left", fontWeight: 700 }}>{it.action}</td>
                        <td style={tdStyle}>
                          <button type="button" style={actionBtn("blue")} onClick={() => onOpen({ siteId: it.site_id })} aria-label={`Historique ${it.site_id}`}>
                            Historique
                          </button>
                        </td>
                        <td style={tdStyle}>
                          {list.data.can_validate ? (
                            <button type="button" style={actionBtn("violet")} onClick={() => act(it)}>{ACTION_BUTTON[it.action_type]}</button>
                          ) : (
                            <span style={{ color: FT.textSub, fontSize: 11 }} title="Réservé aux rôles admin et manager">lecture seule</span>
                          )}
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
