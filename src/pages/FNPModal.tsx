
import { useState, useMemo, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {

  Download,
 
  Search,

  PackageX, 

} from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";
import { getFNPSites, type FNPResponse } from "@/features/sonatelBilling/api";


// ─── Composant modal ─────────────────────────────────────────────────────────
const TYPO_COLORS: Record<string, { bg: string; color: string }> = {
  DGP:  { bg: "#E6F1FB", color: "#0C447C" },
  PGP:  { bg: "#EAF3DE", color: "#27500A" },
  MTG:  { bg: "#FAEEDA", color: "#633806" },
  MTCU: { bg: "#EEEDFE", color: "#3C3489" },
};

const T = {
  blue: "#1B3FA0",
  blueL: "#EEF2FF",
  orange: "#D94F1E",
  orangeL: "#FFF1EC",
  red: "#C8202E",
  redL: "#FFF0F0",
  violet: "#6D28D9",
  violetL: "#F5F0FF",
  cyan: "#0E7490",
  cyanL: "#E0F7FA",
  green: "#10B981",
  greenL: "#ECFDF5",
  slate: "#64748B",
  slateL: "#F8FAFC",
  border: "rgba(15,23,42,.08)",
  text: "#0F172A",
  textMid: "#475569",
  textSub: "#94A3B8",
};

export default function FNPModal({
  data,
  horizon,
  dateStart,
  dateEnd,
  onClose,
}: {
  data: FNPResponse;
  horizon: number;
  dateStart: string;
  dateEnd: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [periodeFilter, setPeriodeFilter] = useState("");
  const [histFilter, setHistFilter] = useState<"" | "none" | "has">("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Fermer sur Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const periods = useMemo(
    () => [...new Set(data.rows.map((r) => r.period))].sort(),
    [data.rows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.rows.filter((r) => {
      if (
        q &&
        !r.site_id.toLowerCase().includes(q) &&
        !(r.site_name ?? "").toLowerCase().includes(q) &&
        !r.numero_compte_contrat.includes(q) &&
        !(r.typology ?? "").toLowerCase().includes(q)
      )
        return false;
      if (periodeFilter && r.period !== periodeFilter) return false;
      if (histFilter === "none" && r.history_months > 0) return false;
      if (histFilter === "has" && r.history_months === 0) return false;
      return true;
    });
  }, [data.rows, search, periodeFilter, histFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalEstHT = filtered.reduce(
    (s, r) => s + (r.est_montant_ht ? Number(r.est_montant_ht) : 0),
    0
  );
  const totalEstTTC = filtered.reduce(
    (s, r) => s + (r.est_montant_ttc ? Number(r.est_montant_ttc) : 0),
    0
  );
  const noHistCount = filtered.filter((r) => r.history_months === 0).length;

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }
  function handleFilter(
    setter: (v: any) => void,
    v: any
  ) {
    setter(v);
    setPage(1);
  }

  function handleExport() {
    const wb = XLSX.utils.book_new();
    const rows = filtered.map((r) => ({
      "Période FNP":        r.period,
      "Site ID":            r.site_id,
      "Site Nom":           r.site_name ?? "",
      "Contrat":            r.numero_compte_contrat,
      "Typologie":          r.typology ?? "",
      "Conso estimée":      r.est_conso ? Number(r.est_conso) : null,
      "HT estimé (FCFA)":   r.est_montant_ht ? Number(r.est_montant_ht) : null,
      "TTC estimé (FCFA)":  r.est_montant_ttc ? Number(r.est_montant_ttc) : null,
      "NRJ estimée (FCFA)": r.est_nrj ? Number(r.est_nrj) : null,
      "PenPrime est. (FCFA)": r.est_penalite ? Number(r.est_penalite) : null,
      "Historique (mois)":  r.history_months,
      "Dernière facture":   r.last_invoice_period ?? "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 10 },
      { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 20 },
      { wch: 14 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "FNP Détail");
    XLSX.writeFile(wb, `fnp_${dateStart}_${dateEnd}.xlsx`);
  }

  // ── Petit helper formatage ────────────────────────────────────────────────
  const fmtV = (v: string | null | undefined) => {
    if (!v) return "—";
    const n = Number(v);
    if (isNaN(n)) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
    if (n >= 1_000)     return `${Math.round(n / 1_000).toLocaleString("fr-FR")} k`;
    return Math.round(n).toLocaleString("fr-FR");
  };

  const EstTag = () => (
    <span
      style={{
        display: "inline-block",
        padding: "1px 4px",
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 600,
        background: T.orangeL,
        color: T.orange,
        marginLeft: 4,
        verticalAlign: "middle",
      }}
    >
      EST
    </span>
  );

  return (
    // Faux overlay en flux normal (pas de position:fixed)
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 20,
          border: `1px solid ${T.border}`,
          boxShadow: "0 24px 80px rgba(15,23,42,0.22)",
          width: "100%",
          maxWidth: 1020,
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "20px 24px 0",
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: T.redL,
                  borderRadius: 100,
                  padding: "3px 10px",
                  marginBottom: 6,
                }}
              >
                <PackageX size={10} color={T.red} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.red,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                  }}
                >
                  Factures Non Parvenues
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: T.text,
                }}
              >
                Détail FNP — {dateStart} → {dateEnd}
              </div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 3 }}>
                {data.summary.sites_count} sites ·{" "}
                {data.summary.fnp_count} périodes manquantes · Horizon{" "}
                <strong style={{ color: T.textMid }}>
                  {horizon} mois
                </strong>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                background: "white",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: T.textMid,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              {
                label: "HT estimé (filtré)",
                value: fmtV(String(totalEstHT)),
                tag: true,
                color: T.blue,
                light: T.blueL,
              },
              {
                label: "TTC estimé (filtré)",
                value: fmtV(String(totalEstTTC)),
                tag: true,
                color: T.cyan,
                light: T.cyanL,
              },
              {
                label: "Résultats filtrés",
                value: String(filtered.length),
                tag: false,
                color: T.textMid,
                light: T.slateL,
              },
              {
                label: "Sans historique",
                value: String(noHistCount),
                tag: false,
                color: noHistCount > 0 ? T.red : T.green,
                light: noHistCount > 0 ? T.redL : T.greenL,
              },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: c.light,
                  borderRadius: 12,
                  padding: "10px 14px",
                  border: `1px solid ${T.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.textSub,
                    textTransform: "uppercase",
                    letterSpacing: ".07em",
                    marginBottom: 4,
                  }}
                >
                  {c.label}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 20,
                      fontWeight: 800,
                      color: c.color,
                    }}
                  >
                    {c.value}
                  </span>
                  {c.tag && (
                    <span
                      style={{
                        padding: "1px 5px",
                        borderRadius: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        background: T.orangeL,
                        color: T.orange,
                      }}
                    >
                      EST
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <Search
                size={12}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: T.textSub,
                  pointerEvents: "none",
                }}
              />
              <input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Site, contrat, typologie…"
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 30px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  color: T.text,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <select
              value={periodeFilter}
              onChange={(e) => handleFilter(setPeriodeFilter, e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                fontSize: 12,
                color: T.text,
                background: "white",
                minWidth: 120,
              }}
            >
              <option value="">Toutes périodes</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={histFilter}
              onChange={(e) =>
                handleFilter(setHistFilter, e.target.value as any)
              }
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                fontSize: 12,
                color: T.text,
                background: "white",
                minWidth: 140,
              }}
            >
              <option value="">Tout historique</option>
              <option value="none">Sans historique</option>
              <option value="has">Avec historique</option>
            </select>

            <button
              onClick={handleExport}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 10,
                background: T.blue,
                border: "none",
                color: "white",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: `0 4px 12px ${T.blue}33`,
                whiteSpace: "nowrap",
              }}
            >
              <Download size={12} />
              Export Excel
            </button>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: T.slateL,
              }}
            >
              <tr>
                {[
                  "Site",
                  "Période FNP",
                  "Typo",
                  "HT estimé",
                  "TTC estimé",
                  "NRJ est.",
                  "PenPrime est.",
                  "Historique",
                  "Dernière fact.",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 12px",
                      textAlign: h === "Site" || h === "Typo" || h === "Période FNP" || h === "Historique" || h === "Dernière fact."
                        ? "left"
                        : "right",
                      fontSize: 10,
                      fontWeight: 700,
                      color: T.textSub,
                      textTransform: "uppercase",
                      letterSpacing: ".07em",
                      borderBottom: `1px solid ${T.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: "40px 24px",
                      textAlign: "center",
                      color: T.textSub,
                      fontSize: 13,
                    }}
                  >
                    Aucun résultat.
                  </td>
                </tr>
              )}
              {pageRows.map((r, i) => {
                const noHist = r.history_months === 0;
                const tc =
                  TYPO_COLORS[r.typology ?? ""] ?? {
                    bg: "#F1F5F9",
                    color: "#64748B",
                  };

                return (
                  <tr
                    key={`${r.numero_compte_contrat}-${r.period}`}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      background:
                        noHist
                          ? "#FFF8F8"
                          : i % 2 === 0
                          ? "white"
                          : T.slateL,
                    }}
                  >
                    <td style={{ padding: "10px 12px", minWidth: 150 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: T.blue,
                          fontFamily: "monospace",
                        }}
                      >
                        {r.site_id}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: T.textSub,
                          marginTop: 1,
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.site_name}
                      </div>
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: T.red,
                          fontSize: 12,
                        }}
                      >
                        {r.period}
                      </span>
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      {r.typology ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            background: tc.bg,
                            color: tc.color,
                          }}
                        >
                          {r.typology}
                        </span>
                      ) : (
                        <span style={{ color: T.textSub, fontSize: 11 }}>—</span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {noHist ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: T.textSub,
                            fontStyle: "italic",
                          }}
                        >
                          Nouveau site
                        </span>
                      ) : (
                        <>
                          <span
                            style={{
                              fontWeight: 700,
                              color: T.text,
                              fontFamily: "monospace",
                            }}
                          >
                            {fmtV(r.est_montant_ht)}
                          </span>
                          <EstTag />
                        </>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {noHist ? (
                        <span style={{ color: T.textSub }}>—</span>
                      ) : (
                        <>
                          <span
                            style={{
                              fontWeight: 600,
                              color: T.blue,
                              fontFamily: "monospace",
                            }}
                          >
                            {fmtV(r.est_montant_ttc)}
                          </span>
                          <EstTag />
                        </>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {noHist ? (
                        <span style={{ color: T.textSub }}>—</span>
                      ) : (
                        <>
                          <span
                            style={{
                              color: T.green,
                              fontFamily: "monospace",
                            }}
                          >
                            {fmtV(r.est_nrj)}
                          </span>
                          <EstTag />
                        </>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {noHist ? (
                        <span style={{ color: T.textSub }}>—</span>
                      ) : (
                        <>
                          <span
                            style={{
                              color: T.red,
                              fontFamily: "monospace",
                            }}
                          >
                            {fmtV(r.est_penalite)}
                          </span>
                          <EstTag />
                        </>
                      )}
                    </td>

                    <td style={{ padding: "10px 12px" }}>
                      {noHist ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 700,
                            background: T.redL,
                            color: T.red,
                          }}
                        >
                          Aucun
                        </span>
                      ) : (
                        <span
                          style={{ fontSize: 12, color: T.textMid }}
                        >
                          {r.history_months} mois
                        </span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "10px 12px",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: T.textSub,
                      }}
                    >
                      {r.last_invoice_period ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: T.slateL,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: T.textSub }}>
            Page <strong style={{ color: T.text }}>{page}</strong> /{" "}
            {totalPages} ·{" "}
            <strong style={{ color: T.text }}>{filtered.length}</strong>{" "}
            lignes
          </span>

          <div style={{ display: "flex", gap: 4 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                background: "white",
                cursor: page <= 1 ? "default" : "pointer",
                opacity: page <= 1 ? 0.4 : 1,
                fontSize: 14,
                color: T.text,
              }}
            >
              ‹
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = Math.max(1, page - 3) + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    border: `1px solid ${T.border}`,
                    background: p === page ? T.blue : "white",
                    color: p === page ? "white" : T.text,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: p === page ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                background: "white",
                cursor: page >= totalPages ? "default" : "pointer",
                opacity: page >= totalPages ? 0.4 : 1,
                fontSize: 14,
                color: T.text,
              }}
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}