import { useMemo, useState, useCallback } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Search,
  Calendar,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BadgeCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { DataTable, Col } from "@/components/DataTable";
import { StatusPill, money, num } from "@/features/sonatelBilling/ui";
import {
  listInvoices,
  listMonthly,
  listContractMonths,
  SonatelInvoice,
  MonthlySynthesis,
  ContractMonth,
  getSonatelBillingStats
} from "@/features/sonatelBilling/api";

const COLORS = {
  navy: "#0f172a",
  navySoft: "#1e293b",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  green: "#059669",
  greenSoft: "#ecfdf5",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  red: "#dc2626",
  redSoft: "#fef2f2",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate700: "#334155",
  white: "#ffffff",
};

type Tab = "INVOICES" | "MONTHLY" | "CONTRACT" | "PENALITES";

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultRange() {
  const now = new Date();
  return { start: fmtDate(new Date(now.getFullYear(), 0, 1)), end: fmtDate(now) };
}

function PayPill({ value, updatedAt }: { value?: string | null; updatedAt?: string | null }) {
  if (!value) {
    return <span style={{ fontSize: 12, color: COLORS.slate400 }}>Non défini</span>;
  }

  const cfg =
    value === "PAID"
      ? { label: "Payée", bg: COLORS.greenSoft, color: COLORS.green }
      : value === "UNPAID"
      ? { label: "Impayée", bg: COLORS.redSoft, color: COLORS.red }
      : { label: "Hors scope", bg: COLORS.slate100, color: COLORS.slate700 };

  return (
    <span
      title={updatedAt ? `Mis à jour le ${updatedAt}` : "Date de mise à jour inconnue"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cfg.color,
        }}
      />
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const toneMap = {
    blue: { bg: COLORS.blueSoft, color: COLORS.blue },
    green: { bg: COLORS.greenSoft, color: COLORS.green },
    amber: { bg: COLORS.amberSoft, color: COLORS.amber },
    red: { bg: COLORS.redSoft, color: COLORS.red },
  }[tone];

  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.slate200}`,
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.slate500, textTransform: "uppercase", letterSpacing: ".06em" }}>
          {label}
        </span>
        <span
          style={{
            width: 34,
            height: 34,
            display: "grid",
            placeItems: "center",
            borderRadius: 10,
            background: toneMap.bg,
            color: toneMap.color,
          }}
        >
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy }}>{value}</div>
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        borderTop: `1px solid ${COLORS.slate200}`,
        background: COLORS.slate50,
      }}
    >
      <div style={{ fontSize: 13, color: COLORS.slate500 }}>
        Page <strong style={{ color: COLORS.navy }}>{page}</strong> / {totalPages} —{" "}
        <strong style={{ color: COLORS.navy }}>{total}</strong> lignes
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${COLORS.slate200}`,
            background: COLORS.white,
            opacity: page <= 1 ? 0.4 : 1,
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${COLORS.slate200}`,
            background: COLORS.white,
            opacity: page >= totalPages ? 0.4 : 1,
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function SonatelBillingPage() {
  const defRange = useMemo(() => defaultRange(), []);
  const [tab, setTab] = useState<Tab>("INVOICES");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("PAID");
  const [site, setSite] = useState("");
  const [page, setPage] = useState(1);
  const [dateStart, setDateStart] = useState(defRange.start);
  const [dateEnd, setDateEnd] = useState(defRange.end);
  const pageSize = 25;

  const tabs = [
    { key: "INVOICES" as Tab, label: "Factures", icon: <FileSpreadsheet size={15} /> },
    { key: "MONTHLY" as Tab, label: "Synthèse mensuelle", icon: <BarChart3 size={15} /> },
    { key: "CONTRACT" as Tab, label: "Contrat × Mois", icon: <TrendingUp size={15} /> },
    { key: "PENALITES" as Tab, label: "Pénalités", icon: <ShieldAlert size={15} /> },
  ];

  const invoicesQ = useQuery({
    enabled: tab === "INVOICES",
    queryKey: ["sb-invoices", { page, search, status, paymentStatus, site, dateStart, dateEnd }],
    queryFn: () =>
      listInvoices({
        page,
        page_size: pageSize,
        search,
        status,
        payment_status: paymentStatus || undefined,
        site,
        start: dateStart,
        end: dateEnd,
      }),
    placeholderData: keepPreviousData,
  });


  const cardsStatsQ = useQuery({
    enabled: tab === "INVOICES",
    queryKey: ["sb-cards-stats", { dateStart, dateEnd, site }],
    queryFn: () =>
      getSonatelBillingStats({
        start: dateStart,
        end: dateEnd,
      }),
    placeholderData: keepPreviousData,
  });

  const paidCountQ = useQuery({
    enabled: tab === "INVOICES",
    queryKey: ["sb-paid-count", { status, site, dateStart, dateEnd }],
    queryFn: () =>
      listInvoices({
        page: 1,
        page_size: 1,
        status: status || undefined,
        site: site || undefined,
        start: dateStart,
        end: dateEnd,
        payment_status: "PAID",
      }),
    placeholderData: keepPreviousData,
  });

  const unpaidCountQ = useQuery({
    enabled: tab === "INVOICES",
    queryKey: ["sb-unpaid-count", { status, site, dateStart, dateEnd }],
    queryFn: () =>
      listInvoices({
        page: 1,
        page_size: 1,
        status: status || undefined,
        site: site || undefined,
        start: dateStart,
        end: dateEnd,
        payment_status: "UNPAID",
      }),
    placeholderData: keepPreviousData,
  });

const outScopeCountQ = useQuery({
  enabled: tab === "INVOICES",
  queryKey: ["sb-outscope-count", { status, site, dateStart, dateEnd }],
  queryFn: () =>
    listInvoices({
      page: 1,
      page_size: 1,
      status: status || undefined,
      site: site || undefined,
      start: dateStart,
      end: dateEnd,
      payment_status: "OUT_OF_SCOPE",
    }),
  placeholderData: keepPreviousData,
});
  const monthlyQ = useQuery({
    enabled: tab === "MONTHLY",
    queryKey: ["sb-monthly", { page, status, site, search, dateStart, dateEnd }],
    queryFn: () =>
      listMonthly({
        page,
        page_size: pageSize,
        status: status || undefined,
        site: site || undefined,
        account: search || undefined,
        start: dateStart,
        end: dateEnd,
      }),
    placeholderData: keepPreviousData,
  });

  const contractQ = useQuery({
    enabled: tab === "CONTRACT",
    queryKey: ["sb-contract-months", { page, status, site, search, dateStart, dateEnd }],
    queryFn: () =>
      listContractMonths({
        page,
        page_size: pageSize,
        status: status || undefined,
        site: site || undefined,
        account: search || undefined,
        start: dateStart,
        end: dateEnd,
      }),
    placeholderData: keepPreviousData,
  });

  const active = tab === "INVOICES" ? invoicesQ : tab === "MONTHLY" ? monthlyQ : contractQ;
  const rows = ((active?.data as any)?.results ?? []) as any[];
  const total = (active?.data as any)?.count ?? 0;

  const summary = useMemo(() => {
    if (tab !== "INVOICES") return null;

    return {
      paid: paidCountQ.data?.count ?? 0,
      unpaid: unpaidCountQ.data?.count ?? 0,
      outScope: outScopeCountQ.data?.count ?? 0,
      totalHT: cardsStatsQ.data?.distribution_ht?.total_ht ?? null,
    };
  }, [
    tab,
    paidCountQ.data?.count,
    unpaidCountQ.data?.count,
    outScopeCountQ.data?.count,
    cardsStatsQ.data?.distribution_ht?.total_ht,
  ]);

  const siteCol = useCallback((r: any) => {
    const siteCode = r?.site?.site_id || r?.site_id || "—";
    const siteName = r?.site?.name || r?.site_name || "";
    return (
      <div style={{ minWidth: 160 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>{siteCode}</div>
        <div style={{ fontSize: 11, color: COLORS.slate500 }}>{siteName}</div>
      </div>
    );
  }, []);

  const mono = useCallback((v?: string | null) => {
    return (
      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: COLORS.slate700 }}>
        {v || "—"}
      </span>
    );
  }, []);

  const amt = useCallback((v: any, color = COLORS.navy) => {
    return (
      <span style={{ whiteSpace: "nowrap", fontWeight: 700, color, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {money(v)}
      </span>
    );
  }, []);

  const invoiceCols: Col<SonatelInvoice>[] = useMemo(
    () => [
      { key: "site", title: "Site", render: siteCol },
      { key: "contract", title: "Contrat", render: (r) => mono(r.numero_compte_contrat) },
      { key: "fact", title: "Facture", render: (r) => mono(r.numero_facture) },
      {
        key: "period",
        title: "Période",
        render: (r) => (
          <div style={{ fontSize: 12 }}>
            <div style={{ color: COLORS.slate700 }}>{r.date_debut_periode || "—"}</div>
            <div style={{ color: COLORS.slate400 }}>→ {r.date_fin_periode || "—"}</div>
          </div>
        ),
      },
      { key: "ht", title: "HT", render: (r) => amt((r as any).montant_hors_tva) },
      { key: "ttc", title: "TTC", render: (r) => amt((r as any).montant_ttc, COLORS.blue) },
      { key: "nrj", title: "NRJ", render: (r) => amt((r as any).energie_calculee, COLORS.green) },
      { key: "pen", title: "PenPrime", render: (r) => amt((r as any).penalite_abonnement_calculee, COLORS.red) },
      { key: "status", title: "Certif.", render: (r) => <StatusPill v={(r as any).status} /> },
      {
        key: "pay",
        title: "Paiement",
        render: (r) => (
          <PayPill
            value={(r as any).payment_status}
            updatedAt={(r as any).payment_status_updated_at}
          />
        ),
      },
    ],
    [siteCol, mono, amt]
  );

  const monthlyCols: Col<MonthlySynthesis>[] = useMemo(
    () => [
      { key: "site", title: "Site", render: siteCol },
      { key: "contract", title: "Contrat", render: (r) => mono(r.numero_compte_contrat) },
      { key: "month", title: "Mois", render: (r) => mono(`${r.year}-${String(r.month).padStart(2, "0")}`) },
      { key: "conso", title: "Conso", render: (r) => <span>{num((r as any).conso)}</span> },
      { key: "ht", title: "HT", render: (r) => amt((r as any).montant_hors_tva) },
      { key: "ttc", title: "TTC", render: (r) => amt((r as any).montant_ttc, COLORS.blue) },
      { key: "abo", title: "Abonnement", render: (r) => amt((r as any).abonnement_calcule, COLORS.amber) },
      { key: "pen", title: "PenPrime", render: (r) => amt((r as any).penalite_abonnement_calculee, COLORS.red) },
      { key: "status", title: "Statut", render: (r) => <StatusPill v={(r as any).status} /> },
    ],
    [siteCol, mono, amt]
  );

  const contractCols: Col<ContractMonth>[] = useMemo(
    () => [
      { key: "site", title: "Site", render: siteCol },
      { key: "contract", title: "Contrat", render: (r) => mono(r.numero_compte_contrat) },
      { key: "month", title: "Mois", render: (r) => mono(`${r.year}-${String(r.month).padStart(2, "0")}`) },
      { key: "count", title: "# Factures", render: (r) => <strong>{(r as any).invoices_count}</strong> },
      { key: "ht", title: "HT", render: (r) => amt((r as any).montant_hors_tva) },
      { key: "ttc", title: "TTC", render: (r) => amt((r as any).montant_ttc, COLORS.blue) },
      { key: "abo", title: "Abonnement", render: (r) => amt((r as any).abonnement_calcule, COLORS.amber) },
      { key: "pen", title: "PenPrime", render: (r) => amt((r as any).penalite_abonnement_calculee, COLORS.red) },
      { key: "nrj", title: "NRJ", render: (r) => amt((r as any).energie_calculee, COLORS.green) },
    ],
    [siteCol, mono, amt]
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)", padding: 24 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 18 }}>
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            borderRadius: 24,
            padding: 24,
            color: "white",
            boxShadow: "0 20px 40px rgba(15,23,42,.20)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Billing Sonatel</div>
              <div style={{ color: "#cbd5e1", fontSize: 14 }}>
                Factures, synthèses mensuelles, agrégats contrat et suivi des paiements
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    setPage(1);
                    if (t.key !== "INVOICES") setPaymentStatus("");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    background: tab === t.key ? "#ffffff" : "rgba(255,255,255,.08)",
                    color: tab === t.key ? COLORS.navy : "#ffffff",
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.slate200}`,
            borderRadius: 20,
            padding: 18,
            boxShadow: "0 10px 30px rgba(15,23,42,.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 12,
            }}
          >
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: 12, color: COLORS.slate400 }} />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={tab === "INVOICES" ? "Facture / contrat..." : "Contrat..."}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.slate300}`,
                  outline: "none",
                }}
              />
            </div>

            <input
              value={site}
              onChange={(e) => {
                setSite(e.target.value);
                setPage(1);
              }}
              placeholder="Site ID"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.slate300}`,
                outline: "none",
              }}
            />

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${COLORS.slate300}`,
                outline: "none",
              }}
            >
              <option value="">Tous statuts certif.</option>
              <option value="CREATED">Créée</option>
              <option value="VALIDATED">Validée</option>
              <option value="CONTESTED">Contestée</option>
            </select>

            {tab === "INVOICES" && (
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.slate300}`,
                  outline: "none",
                }}
              >
                <option value="">Tous paiements</option>
                <option value="PAID">Payée</option>
                <option value="UNPAID">Impayée</option>
                <option value="OUT_OF_SCOPE">Hors scope</option>
              </select>
            )}

            <div style={{ position: "relative" }}>
              <Calendar size={14} style={{ position: "absolute", left: 12, top: 12, color: COLORS.slate400 }} />
              <input
                type="date"
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.slate300}`,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Calendar size={14} style={{ position: "absolute", left: 12, top: 12, color: COLORS.slate400 }} />
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => {
                  setDateEnd(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.slate300}`,
                  outline: "none",
                }}
              />
            </div>
          </div>
        </div>

        {tab === "INVOICES" && summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            <StatCard label="Montant HT (interval)" value={money(summary.totalHT)} icon={<Wallet size={16} />} tone="blue" />
            <StatCard label="Factures payées" value={summary.paid} icon={<BadgeCheck size={16} />} tone="green" />
            <StatCard label="Factures impayées" value={summary.unpaid} icon={<AlertTriangle size={16} />} tone="red" />
            <StatCard label="Hors scope" value={summary.outScope} icon={<ShieldAlert size={16} />} tone="amber" />
          </div>
        )}

        <div
          style={{
            background: COLORS.white,
            border: `1px solid ${COLORS.slate200}`,
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(15,23,42,.05)",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: `1px solid ${COLORS.slate200}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: COLORS.slate50,
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.navy }}>
                {tab === "INVOICES"
                  ? "Liste des factures"
                  : tab === "MONTHLY"
                  ? "Synthèse mensuelle"
                  : tab === "CONTRACT"
                  ? "Agrégat contrat × mois"
                  : "Pénalités"}
              </div>
              <div style={{ fontSize: 12, color: COLORS.slate500 }}>
                {active?.isFetching ? "Actualisation en cours..." : `${total} enregistrement(s)`}
              </div>
            </div>

            {active?.isFetching && <RefreshCw size={16} style={{ color: COLORS.blue }} />}
          </div>
          
          {tab !== "PENALITES" ? (
            <>
              
              <div style={{ overflowX: "auto" }}>
                
                <DataTable
                  cols={tab === "INVOICES" ? invoiceCols : tab === "MONTHLY" ? monthlyCols : contractCols}
                  rows={rows}
                  loading={active?.isLoading}
                />
              </div>
              <Pagination page={page} total={total} pageSize={pageSize} onPage={setPage} />
            </>
          ) : (
            <div style={{ padding: 24, color: COLORS.slate500 }}>
              Garde ici ton composant pénalités actuel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}