// src/pages/InvoicesListPage.tsx
import { useState, useEffect, type CSSProperties } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Download, Search, RefreshCw, FileText, CheckCircle2, X,
  ChevronLeft, ChevronRight, Loader2, Calendar,
} from "lucide-react";
import { api } from "@/services/api";
import * as XLSX from "xlsx";
import { listInvoices, type SonatelInvoice } from "@/features/sonatelBilling/api";

// ─── Design tokens (partagés avec BillingTrackingPage) ───────────────────────
const C = {
  blue:  { 950: "#0B1F4D", 900: "#0F235A", 800: "#123C8C", 700: "#1A56C4", 600: "#2464D6", 300: "#91B9F8", 100: "#E4EFFE", 50: "#F2F6FE" },
  slate: { 900: "#0F172A", 800: "#1E293B", 700: "#334155", 600: "#475569", 500: "#64748B", 400: "#94A3B8", 300: "#CBD5E1", 200: "#E2E8F0", 100: "#F1F5F9", 50: "#F8FAFC" },
  ok:    { main: "#059669", light: "#D1FAE5", mid: "#A7F3D0" },
  nok:   { main: "#DC2626", light: "#FEE2E2", mid: "#FECACA" },
  warn:  { main: "#D97706", light: "#FEF3C7", mid: "#FDE68A" },
};

const PAGE_SIZE = 25;

type CertFilter   = "" | "CREATED" | "VALIDATED" | "CONTESTED";
type PayFilter    = "" | "PAID" | "UNPAID" | "OUT_OF_SCOPE";

// ─── Types stats allégées (summary) ──────────────────────────────────────────
interface StatsSummary {
  payment_statuses?: {
    summary: { total: number; paid: number; unpaid: number; out_of_scope: number; undefined: number; paid_pct: number };
  };
  invoice_certification?: {
    summary: { total: number; certified: number; contested: number; created: number; taux_certification: number };
  };
}

async function fetchSummary(start: string, end: string): Promise<StatsSummary> {
  const { data } = await api.get("/sonatel-billing/stats/", { params: { start, end, scope: "ALL" } });
  return data;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function defaultRange() {
  const now = new Date();
  return { start: fmtDate(new Date(now.getFullYear(), 0, 1)), end: fmtDate(now) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiTile({ label, value, color, bg, sub }: { label: string; value: string | number; color: string; bg: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 18px", borderRadius: 16, background: bg, border: `1px solid ${C.slate[200]}`, minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 950, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[600], marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C.slate[400], marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return <div className="inv-skel" style={{ height: h, borderRadius: 12 }} />;
}

const certLabel = (s: SonatelInvoice["status"]) =>
  s === "VALIDATED" ? "Validée" : s === "CONTESTED" ? "Contestée" : "Créée";
const certColor = (s: SonatelInvoice["status"]) =>
  s === "VALIDATED" ? C.ok.main : s === "CONTESTED" ? C.nok.main : C.warn.main;

const psLabel = (p?: string | null) =>
  p === "PAID" ? "Payée" : p === "UNPAID" ? "Impayée" : p === "OUT_OF_SCOPE" ? "Hors scope" : "—";
const psColor = (p?: string | null) =>
  p === "PAID" ? C.ok.main : p === "UNPAID" ? C.nok.main : C.slate[400];

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InvoicesListPage() {
  const defRange = defaultRange();
  const [dateStart, setDateStart] = useState(defRange.start);
  const [dateEnd,   setDateEnd]   = useState(defRange.end);
  const [search,    setSearch]    = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [certFilter, setCertFilter]   = useState<CertFilter>("");
  const [payFilter,  setPayFilter]    = useState<PayFilter>("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [dateStart, dateEnd, debouncedSearch, certFilter, payFilter]);

  const summaryQ = useQuery({
    queryKey: ["inv-summary", dateStart, dateEnd],
    queryFn: () => fetchSummary(dateStart, dateEnd),
    staleTime: 5 * 60_000,
  });

  const invoicesQ = useQuery({
    queryKey: ["inv-list", dateStart, dateEnd, debouncedSearch, certFilter, payFilter, page],
    queryFn: () => listInvoices({
      start: dateStart, end: dateEnd,
      search: debouncedSearch || undefined,
      status: certFilter || undefined,
      payment_status: payFilter || undefined,
      page, page_size: PAGE_SIZE,
    }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const summary = summaryQ.data;
  const ps  = summary?.payment_statuses?.summary;
  const ic  = summary?.invoice_certification?.summary;
  const totalPages = invoicesQ.data ? Math.ceil(invoicesQ.data.count / PAGE_SIZE) : 1;

  async function handleExport() {
    setExporting(true);
    try {
      const all = await listInvoices({
        start: dateStart, end: dateEnd,
        search: debouncedSearch || undefined,
        status: certFilter || undefined,
        payment_status: payFilter || undefined,
        page: 1, page_size: 9999,
      });
      const wb = XLSX.utils.book_new();
      const rows = all.results.map((inv) => ({
        "N° Facture":        inv.numero_facture || "",
        "Site ID":           inv.site?.site_id || "",
        "Nom du site":       inv.site?.name || "",
        "Contrat":           inv.numero_compte_contrat || "",
        "Date comptable":    inv.date_comptable_facture || "",
        "Début période":     inv.date_debut_periode || "",
        "Fin période":       inv.date_fin_periode || "",
        "Statut cert.":      certLabel(inv.status),
        "Statut paiement":   psLabel(inv.payment_status),
        "Montant HT (FCFA)": inv.montant_hors_tva ? Number(inv.montant_hors_tva) : "",
        "Montant TTC (FCFA)":inv.montant_ttc ? Number(inv.montant_ttc) : "",
        "Cos φ (FCFA)":      inv.montant_cosinus_phi ? Number(inv.montant_cosinus_phi) : "",
        "Énergie calculée":  inv.energie_calculee ? Number(inv.energie_calculee) : "",
        "Abonnement calc.":  inv.abonnement_calcule ? Number(inv.abonnement_calcule) : "",
        "Pénalité calc.":    inv.penalite_abonnement_calculee ? Number(inv.penalite_abonnement_calculee) : "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 16 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
        { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Factures");
      XLSX.writeFile(wb, `factures_${dateStart}_${dateEnd}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  const inputStyle: CSSProperties = {
    height: 36, borderRadius: 10, border: `1px solid ${C.slate[200]}`,
    padding: "0 11px", fontSize: 12.5, color: C.slate[700], outline: "none", background: "#fff",
  };
  const chipStyle = (active: boolean, col: string): CSSProperties => ({
    padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: 700,
    border: `1px solid ${active ? col : C.slate[200]}`,
    background: active ? col : "#fff",
    color: active ? "#fff" : C.slate[600],
    cursor: "pointer", transition: "all .13s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#F8FAFC 0%,#EEF4FF 100%)", color: C.slate[800] }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        .inv-skel { background: linear-gradient(90deg,#F1F5F9 25%,#E8EFF6 50%,#F1F5F9 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        .inv-row:hover { background: ${C.blue[50]} !important; }
      `}</style>

      {/* ── En-tête ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: `1px solid ${C.slate[200]}`, padding: "16px 24px 14px", boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: C.blue[700], display: "grid", placeItems: "center", flexShrink: 0 }}>
              <FileText size={17} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 950, color: C.blue[950], letterSpacing: "-.02em", lineHeight: 1.15 }}>
                Factures Sonatel
              </h1>
              <div style={{ fontSize: 11.5, color: C.slate[500] }}>
                Base complète des factures · statuts paiement & certification
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Période */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${C.slate[200]}`, borderRadius: 12, padding: "0 12px", height: 36 }}>
              <Calendar size={13} color={C.slate[400]} />
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: C.slate[700] }} />
              <span style={{ color: C.slate[300], fontSize: 11 }}>→</span>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: C.slate[700] }} />
            </div>

            {/* Recherche */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${C.slate[200]}`, borderRadius: 10, padding: "0 10px", height: 36, background: "#fff" }}>
              <Search size={13} color={C.slate[400]} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="N° facture, site, contrat…"
                style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: C.slate[700], width: 200 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.slate[400], display: "grid", placeItems: "center", padding: 2 }}>
                  <X size={12} />
                </button>
              )}
              {invoicesQ.isFetching && (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: C.slate[400] }} />
              )}
            </div>

            {/* Actualiser */}
            <button onClick={() => { invoicesQ.refetch(); summaryQ.refetch(); }} style={{ height: 36, borderRadius: 10, border: `1px solid ${C.slate[200]}`, background: C.slate[50], color: C.slate[700], cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12, fontWeight: 700 }}>
              <RefreshCw size={13} style={{ animation: invoicesQ.isFetching ? "spin 1s linear infinite" : "none" }} />
              Actualiser
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting || !invoicesQ.data?.count}
              style={{ height: 36, borderRadius: 10, border: "none", background: exporting ? C.slate[300] : C.blue[700], color: "#fff", cursor: exporting ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6, padding: "0 14px", fontSize: 12, fontWeight: 800 }}
            >
              {exporting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={13} />}
              {exporting ? "Export…" : "Exporter Excel"}
              {invoicesQ.data?.count ? ` (${invoicesQ.data.count.toLocaleString("fr-FR")})` : ""}
            </button>
          </div>
        </div>

        {/* Filtres cert & paiement */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.slate[400], textTransform: "uppercase", letterSpacing: ".08em" }}>Certification</span>
            {([["", "Tous"], ["VALIDATED", "Validées"], ["CONTESTED", "Contestées"], ["CREATED", "Brutes"]] as [CertFilter, string][]).map(([v, lbl]) => (
              <button key={v} onClick={() => setCertFilter(v)} style={chipStyle(certFilter === v, C.blue[700])}>{lbl}</button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: C.slate[200] }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: C.slate[400], textTransform: "uppercase", letterSpacing: ".08em" }}>Paiement</span>
            {([["", "Tous"], ["PAID", "Payées"], ["UNPAID", "Impayées"], ["OUT_OF_SCOPE", "Hors scope"]] as [PayFilter, string][]).map(([v, lbl]) => (
              <button key={v} onClick={() => setPayFilter(v)} style={chipStyle(payFilter === v, v === "PAID" ? C.ok.main : v === "UNPAID" ? C.nok.main : v === "OUT_OF_SCOPE" ? C.warn.main : C.blue[700])}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Corps ── */}
      <div style={{ padding: "20px 24px", display: "grid", gap: 16 }}>

        {/* KPIs */}
        {summaryQ.isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 12 }}>
            {Array(8).fill(0).map((_, i) => <div key={i} className="inv-skel" style={{ height: 80 }} />)}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {ps && (
              <>
                <KpiTile label="Total factures" value={ps.total.toLocaleString("fr-FR")} color={C.blue[700]} bg={C.blue[50]} />
                <KpiTile label="Payées" value={ps.paid.toLocaleString("fr-FR")} color={C.ok.main} bg={C.ok.light} sub={`${ps.paid_pct}% taux payé`} />
                <KpiTile label="Impayées" value={ps.unpaid.toLocaleString("fr-FR")} color={C.nok.main} bg={C.nok.light} />
                <KpiTile label="Hors scope" value={ps.out_of_scope.toLocaleString("fr-FR")} color={C.warn.main} bg={C.warn.light} />
                <KpiTile label="Non défini" value={ps.undefined.toLocaleString("fr-FR")} color={C.slate[500]} bg={C.slate[100]} />
              </>
            )}
            {ic && (
              <>
                <div style={{ width: 1, alignSelf: "stretch", background: C.slate[200], margin: "0 4px" }} />
                <KpiTile label="Certifiées" value={ic.certified.toLocaleString("fr-FR")} color={C.ok.main} bg={C.ok.light} sub={`${ic.taux_certification}% taux`} />
                <KpiTile label="Contestées" value={ic.contested.toLocaleString("fr-FR")} color={C.nok.main} bg={C.nok.light} />
                <KpiTile label="Brutes" value={ic.created.toLocaleString("fr-FR")} color={C.warn.main} bg={C.warn.light} />
              </>
            )}
          </div>
        )}

        {/* Tableau */}
        <div style={{ background: "#fff", borderRadius: 20, border: `1px solid ${C.slate[200]}`, boxShadow: "0 4px 20px rgba(15,23,42,.05)", overflow: "hidden" }}>

          {invoicesQ.isLoading ? (
            <div style={{ padding: 24, display: "grid", gap: 10 }}>
              {Array(8).fill(0).map((_, i) => <Skeleton key={i} h={40} />)}
            </div>
          ) : !invoicesQ.data || invoicesQ.data.count === 0 ? (
            <div style={{ padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={28} color={C.slate[300]} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.slate[400] }}>Aucune facture trouvée</div>
              <div style={{ fontSize: 12, color: C.slate[300] }}>Modifiez les filtres ou la période</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {["N° Facture", "Site ID", "Nom du site", "Contrat", "Début période", "Fin période", "Certification", "Paiement", "Montant TTC"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 900, color: C.slate[500], fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", borderBottom: `1px solid ${C.slate[200]}`, background: C.slate[50], whiteSpace: "nowrap", position: "sticky", top: 0 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoicesQ.data.results.map((inv, i) => (
                    <tr key={inv.id} className="inv-row" style={{ borderBottom: `1px solid ${C.slate[100]}`, background: i % 2 === 0 ? "#fff" : C.slate[50] }}>
                      <td style={{ padding: "9px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: C.blue[700], whiteSpace: "nowrap" }}>
                        {inv.numero_facture || "—"}
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        {inv.site?.site_id
                          ? <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: C.blue[800], background: C.blue[50], borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>{inv.site.site_id}</span>
                          : <span style={{ color: C.slate[300], fontStyle: "italic", fontSize: 11 }}>non lié</span>
                        }
                      </td>
                      <td style={{ padding: "9px 14px", color: inv.site?.name ? C.slate[700] : C.slate[300], fontStyle: inv.site?.name ? "normal" : "italic", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {inv.site?.name || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: C.slate[600], fontSize: 11, whiteSpace: "nowrap" }}>
                        {inv.numero_compte_contrat || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", color: C.slate[600], whiteSpace: "nowrap" }}>{inv.date_debut_periode || "—"}</td>
                      <td style={{ padding: "9px 14px", color: C.slate[600], whiteSpace: "nowrap" }}>{inv.date_fin_periode || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: certColor(inv.status), background: certColor(inv.status) + "18", borderRadius: 6, padding: "2px 8px" }}>
                          {certLabel(inv.status)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: psColor(inv.payment_status), background: psColor(inv.payment_status) + "18", borderRadius: 6, padding: "2px 8px" }}>
                          {psLabel(inv.payment_status)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 700, color: C.slate[900], textAlign: "right", whiteSpace: "nowrap" }}>
                        {inv.montant_ttc ? Number(inv.montant_ttc).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {invoicesQ.data && invoicesQ.data.count > PAGE_SIZE && (
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.slate[200]}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.slate[50] }}>
              <div style={{ fontSize: 12, color: C.slate[500] }}>
                Page <strong style={{ color: C.slate[800] }}>{page}</strong> / {totalPages}
                {" — "}<strong style={{ color: C.slate[800] }}>{invoicesQ.data.count.toLocaleString("fr-FR")}</strong> factures
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.slate[200]}`, background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1, display: "grid", placeItems: "center" }}>
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.slate[200]}`, background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1, display: "grid", placeItems: "center" }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
