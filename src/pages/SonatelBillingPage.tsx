import { useMemo, useState, useCallback } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Download,
  Loader2,
  Database,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { DataTable, Col } from "@/components/DataTable";
import { StatusPill, money, num } from "@/features/sonatelBilling/ui";
import {
  listInvoices,
  listMonthly,
  listContractMonths,
  SonatelInvoice,
  MonthlySynthesis,
  ContractMonth,
  getSonatelBillingStats,
  updateInvoiceStatus,
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

type Tab = "INVOICES" | "MONTHLY" | "CONTRACT";

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function certLabelText(s: string) {
  return s === "VALIDATED" ? "Validée" : s === "CONTESTED" ? "Contestée" : "Créée";
}
function payLabelText(s?: string | null) {
  return s === "PAID" ? "Payée" : s === "UNPAID" ? "Impayée" : s === "OUT_OF_SCOPE" ? "Hors scope" : "—";
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


// ─── Composant cellule status certif éditable ───────────────────────────────
function EditableStatusCell({ row }: { row: SonatelInvoice }) {
  const [editing, setEditing] = useState(false);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const current = optimistic ?? row.status;

  const { mutate, isPending } = useMutation({
    mutationFn: (status: string) => updateInvoiceStatus(row.id, { status }),
    onMutate: (status) => setOptimistic(status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sb-invoices"] }),
    onError: () => setOptimistic(null),
    onSettled: () => setEditing(false),
  });

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={current}
        disabled={isPending}
        onBlur={() => setEditing(false)}
        onChange={(e) => mutate(e.target.value)}
        style={{
          padding: "4px 8px",
          borderRadius: 8,
          border: `1px solid ${COLORS.slate300}`,
          fontSize: 12,
          fontWeight: 700,
          background: COLORS.white,
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="CREATED">Créée</option>
        <option value="VALIDATED">Validée</option>
        <option value="CONTESTED">Contestée</option>
      </select>
    );
  }

  return (
    <span
      title="Cliquer pour modifier"
      onClick={() => setEditing(true)}
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <StatusPill v={current as any} />
      <span style={{ fontSize: 10, color: COLORS.slate400 }}>✎</span>
    </span>
  );
}

// ─── Composant cellule paiement éditable ────────────────────────────────────
function EditablePaymentCell({ row }: { row: SonatelInvoice }) {
  const [editing, setEditing] = useState(false);
  const [optimistic, setOptimistic] = useState<string | null | undefined>(undefined);
  const queryClient = useQueryClient();

  const current = optimistic !== undefined ? optimistic : row.payment_status;

  const { mutate, isPending } = useMutation({
    mutationFn: (payment_status: string) =>
      updateInvoiceStatus(row.id, { payment_status }),
    onMutate: (v) => setOptimistic(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sb-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sb-paid-count"] });
      queryClient.invalidateQueries({ queryKey: ["sb-unpaid-count"] });
      queryClient.invalidateQueries({ queryKey: ["sb-outscope-count"] });
    },
    onError: () => setOptimistic(undefined),
    onSettled: () => setEditing(false),
  });

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={current ?? ""}
        disabled={isPending}
        onBlur={() => setEditing(false)}
        onChange={(e) => mutate(e.target.value)}
        style={{
          padding: "4px 8px",
          borderRadius: 8,
          border: `1px solid ${COLORS.slate300}`,
          fontSize: 12,
          fontWeight: 700,
          background: COLORS.white,
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="PAID">Payée</option>
        <option value="UNPAID">Impayée</option>
        <option value="OUT_OF_SCOPE">Hors scope</option>
      </select>
    );
  }

  return (
    <span
      title="Cliquer pour modifier"
      onClick={() => setEditing(true)}
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <PayPill value={current} updatedAt={row.payment_status_updated_at} />
      <span style={{ fontSize: 10, color: COLORS.slate400 }}>✎</span>
    </span>
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
  const [exporting, setExporting] = useState(false);
  const [exportingMonthly, setExportingMonthly] = useState(false);
  const [exportingContract, setExportingContract] = useState(false);
  const [showDB, setShowDB] = useState(false);
  const [dbSearch, setDbSearch] = useState("");
  const [dbDateStart, setDbDateStart] = useState(defRange.start);
  const [dbDateEnd, setDbDateEnd] = useState(defRange.end);
  const [dbStatus, setDbStatus] = useState("");
  const [dbPayStatus, setDbPayStatus] = useState("");
  const [dbPage, setDbPage] = useState(1);
  const [dbExporting, setDbExporting] = useState(false);
  const pageSize = 25;
  const DB_PAGE_SIZE = 50;

  const dbQ = useQuery({
    enabled: showDB,
    queryKey: ["sb-db", dbSearch, dbDateStart, dbDateEnd, dbStatus, dbPayStatus, dbPage],
    queryFn: () => listInvoices({
      search: dbSearch || undefined,
      start: dbDateStart,
      end: dbDateEnd,
      status: dbStatus || undefined,
      payment_status: dbPayStatus || undefined,
      page: dbPage,
      page_size: DB_PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  async function handleDBExport() {
    setDbExporting(true);
    try {
      const all = await listInvoices({
        start: dbDateStart, end: dbDateEnd,
        search: dbSearch || undefined,
        status: dbStatus || undefined,
        payment_status: dbPayStatus || undefined,
        page: 1, page_size: 9999,
      });
      const wb = XLSX.utils.book_new();
      const rows = all.results.map((inv) => ({
        "N° Facture":          inv.numero_facture || "",
        "Contrat":             inv.numero_compte_contrat || "",
        "Date comptable":      inv.date_comptable_facture || "",
        "Début période":       inv.date_debut_periode || "",
        "Fin période":         inv.date_fin_periode || "",
        "Statut cert.":        certLabelText(inv.status),
        "Statut paiement":     payLabelText(inv.payment_status),
        "Montant HT (FCFA)":   inv.montant_hors_tva ? Number(inv.montant_hors_tva) : "",
        "Montant TTC (FCFA)":  inv.montant_ttc ? Number(inv.montant_ttc) : "",
        "Cos φ (FCFA)":        inv.montant_cosinus_phi ? Number(inv.montant_cosinus_phi) : "",
        "Énergie calculée":    inv.energie_calculee ? Number(inv.energie_calculee) : "",
        "Abonnement calc.":    inv.abonnement_calcule ? Number(inv.abonnement_calcule) : "",
        "Pénalité calc.":      inv.penalite_abonnement_calculee ? Number(inv.penalite_abonnement_calculee) : "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 24 }, { wch: 22 }, { wch: 16 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
        { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Factures");
      XLSX.writeFile(wb, `base_factures_${dbDateStart}_${dbDateEnd}.xlsx`);
    } finally {
      setDbExporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const all = await listInvoices({
        start: dateStart,
        end: dateEnd,
        search: search || undefined,
        status: status || undefined,
        payment_status: paymentStatus || undefined,
        site: site || undefined,
        page: 1,
        page_size: 9999,
      });
      const wb = XLSX.utils.book_new();
      const rows = all.results.map((inv) => ({
        "N° Facture":          inv.numero_facture || "",
        "Site ID":             inv.site?.site_id || "",
        "Nom du site":         inv.site?.name || "",
        "Contrat":             inv.numero_compte_contrat || "",
        "Date comptable":      inv.date_comptable_facture || "",
        "Début période":       inv.date_debut_periode || "",
        "Fin période":         inv.date_fin_periode || "",
        "Statut cert.":        certLabelText(inv.status),
        "Statut paiement":     payLabelText(inv.payment_status),
        "Montant HT (FCFA)":   inv.montant_hors_tva ? Number(inv.montant_hors_tva) : "",
        "Montant TTC (FCFA)":  inv.montant_ttc ? Number(inv.montant_ttc) : "",
        "Cos φ (FCFA)":        inv.montant_cosinus_phi ? Number(inv.montant_cosinus_phi) : "",
        "Énergie calculée":    inv.energie_calculee ? Number(inv.energie_calculee) : "",
        "Abonnement calc.":    inv.abonnement_calcule ? Number(inv.abonnement_calcule) : "",
        "Pénalité calc.":      inv.penalite_abonnement_calculee ? Number(inv.penalite_abonnement_calculee) : "",
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

  async function handleMonthlyExport() {
    setExportingMonthly(true);
    try {
      const all = await listMonthly({
        start: dateStart, end: dateEnd,
        status: status || undefined,
        site: site || undefined,
        account: search || undefined,
        page: 1, page_size: 9999,
      });
      const wb = XLSX.utils.book_new();
      const rows = all.results.map((r) => ({
        "Site ID":            r.site_id || "",
        "Nom du site":        r.site_name || "",
        "Contrat":            r.numero_compte_contrat || "",
        "Facture":            r.numero_facture || "",
        "Année":              r.year,
        "Mois":               r.month,
        "Conso":              r.conso ? Number(r.conso) : "",
        "Montant HT (FCFA)":  r.montant_hors_tva ? Number(r.montant_hors_tva) : "",
        "Montant TTC (FCFA)": r.montant_ttc ? Number(r.montant_ttc) : "",
        "Abonnement calc.":   r.abonnement_calcule ? Number(r.abonnement_calcule) : "",
        "Pénalité calc.":     r.penalite_abonnement_calculee ? Number(r.penalite_abonnement_calculee) : "",
        "Énergie calculée":   r.energie_calculee ? Number(r.energie_calculee) : "",
        "Statut certif.":     certLabelText(r.status),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 22 }, { wch: 24 },
        { wch: 8 }, { wch: 8 }, { wch: 14 },
        { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Synthèse mensuelle");
      XLSX.writeFile(wb, `synthese_mensuelle_${dateStart}_${dateEnd}.xlsx`);
    } finally {
      setExportingMonthly(false);
    }
  }

  async function handleContractExport() {
    setExportingContract(true);
    try {
      const all = await listContractMonths({
        start: dateStart, end: dateEnd,
        status: status || undefined,
        site: site || undefined,
        account: search || undefined,
        page: 1, page_size: 9999,
      });
      const wb = XLSX.utils.book_new();
      const rows = all.results.map((r) => ({
        "Site ID":            r.site_id || "",
        "Nom du site":        r.site_name || "",
        "Contrat":            r.numero_compte_contrat || "",
        "Année":              r.year,
        "Mois":               r.month,
        "# Factures":         r.invoices_count,
        "Conso":              r.conso ? Number(r.conso) : "",
        "Montant HT (FCFA)":  r.montant_hors_tva ? Number(r.montant_hors_tva) : "",
        "Montant TTC (FCFA)": r.montant_ttc ? Number(r.montant_ttc) : "",
        "Abonnement calc.":   r.abonnement_calcule ? Number(r.abonnement_calcule) : "",
        "Pénalité calc.":     r.penalite_abonnement_calculee ? Number(r.penalite_abonnement_calculee) : "",
        "Énergie calculée":   r.energie_calculee ? Number(r.energie_calculee) : "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 14 }, { wch: 28 }, { wch: 22 },
        { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
        { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Contrat × Mois");
      XLSX.writeFile(wb, `contrat_mois_${dateStart}_${dateEnd}.xlsx`);
    } finally {
      setExportingContract(false);
    }
  }

  const tabs = [
    { key: "INVOICES" as Tab, label: "Factures", icon: <FileSpreadsheet size={15} /> },
    { key: "MONTHLY" as Tab, label: "Synthèse mensuelle", icon: <BarChart3 size={15} /> },
    { key: "CONTRACT" as Tab, label: "Contrat × Mois", icon: <TrendingUp size={15} /> },
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
      { key: "status", title: "Certif.", render: (r) => <EditableStatusCell row={r} /> },
      {
        key: "pay",
        title: "Paiement",
        render: (r) => <EditablePaymentCell row={r} />,
      },
      /*{
        key: "pay",
        title: "Paiement",
        render: (r) => (
          <PayPill
            value={(r as any).payment_status}
            updatedAt={(r as any).payment_status_updated_at}
          />
        ),
      },*/
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "grid", gap: 18 }}>
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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

              <button
                onClick={() => setShowDB(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(255,255,255,.25)",
                  cursor: "pointer",
                  fontWeight: 700,
                  background: "rgba(255,255,255,.05)",
                  color: "#ffffff",
                  marginLeft: 8,
                }}
              >
                <Database size={15} />
                Base de données
              </button>

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
                  : "Agrégat contrat × mois"}
              </div>
              <div style={{ fontSize: 12, color: COLORS.slate500 }}>
                {active?.isFetching ? "Actualisation en cours..." : `${total} enregistrement(s)`}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {active?.isFetching && <RefreshCw size={16} style={{ color: COLORS.blue }} />}
              {tab === "INVOICES" && (
                <button
                  onClick={handleExport}
                  disabled={exporting || total === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 16px", borderRadius: 10, border: "none",
                    background: exporting || total === 0 ? COLORS.slate200 : COLORS.blue,
                    color: exporting || total === 0 ? COLORS.slate400 : COLORS.white,
                    fontWeight: 700, fontSize: 13, cursor: exporting || total === 0 ? "not-allowed" : "pointer",
                    transition: "background .15s",
                  }}
                >
                  {exporting
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <Download size={14} />
                  }
                  {exporting ? "Export en cours…" : `Exporter Excel${total > 0 ? ` (${total.toLocaleString("fr-FR")})` : ""}`}
                </button>
              )}
              {tab === "MONTHLY" && (
                <button
                  onClick={handleMonthlyExport}
                  disabled={exportingMonthly || total === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 16px", borderRadius: 10, border: "none",
                    background: exportingMonthly || total === 0 ? COLORS.slate200 : COLORS.blue,
                    color: exportingMonthly || total === 0 ? COLORS.slate400 : COLORS.white,
                    fontWeight: 700, fontSize: 13, cursor: exportingMonthly || total === 0 ? "not-allowed" : "pointer",
                    transition: "background .15s",
                  }}
                >
                  {exportingMonthly
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <Download size={14} />
                  }
                  {exportingMonthly ? "Export en cours…" : `Exporter Excel${total > 0 ? ` (${total.toLocaleString("fr-FR")})` : ""}`}
                </button>
              )}
              {tab === "CONTRACT" && (
                <button
                  onClick={handleContractExport}
                  disabled={exportingContract || total === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 16px", borderRadius: 10, border: "none",
                    background: exportingContract || total === 0 ? COLORS.slate200 : COLORS.blue,
                    color: exportingContract || total === 0 ? COLORS.slate400 : COLORS.white,
                    fontWeight: 700, fontSize: 13, cursor: exportingContract || total === 0 ? "not-allowed" : "pointer",
                    transition: "background .15s",
                  }}
                >
                  {exportingContract
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <Download size={14} />
                  }
                  {exportingContract ? "Export en cours…" : `Exporter Excel${total > 0 ? ` (${total.toLocaleString("fr-FR")})` : ""}`}
                </button>
              )}
            </div>
          </div>

          <DataTable
            bare
            cols={
              tab === "INVOICES"
                ? (invoiceCols as Col<any>[])
                : tab === "MONTHLY"
                ? (monthlyCols as Col<any>[])
                : (contractCols as Col<any>[])
            }
            rows={rows}
            loading={active?.isLoading}
            emptyText={
              tab === "INVOICES"
                ? "Aucune facture pour les filtres sélectionnés."
                : tab === "MONTHLY"
                ? "Aucune synthèse mensuelle pour les filtres sélectionnés."
                : "Aucun agrégat contrat × mois pour les filtres sélectionnés."
            }
          />

          {total > pageSize && (
            <Pagination page={page} total={total} pageSize={pageSize} onPage={setPage} />
          )}
        </div>
      </div>

      {/* ─── Modal Base de données ─────────────────────────────────────────── */}
      {showDB && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,.65)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "center",
            padding: 0,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDB(false); }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1400,
              margin: "16px auto",
              background: COLORS.white,
              borderRadius: 20,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(15,23,42,.35)",
            }}
          >
            {/* Header modal */}
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                padding: "20px 24px",
                color: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <Database size={20} />
                    <span style={{ fontSize: 22, fontWeight: 900 }}>Base de données — Factures</span>
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                    {dbQ.data
                      ? `${dbQ.data.count.toLocaleString("fr-FR")} facture(s) trouvée(s)`
                      : dbQ.isFetching
                      ? "Chargement…"
                      : "Toutes les factures importées"}
                  </div>
                </div>
                <button
                  onClick={() => setShowDB(false)}
                  aria-label="Fermer"
                  style={{
                    background: "rgba(255,255,255,.1)",
                    border: "none",
                    color: "white",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Filtres */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: 11, color: "#94a3b8" }} />
                  <input
                    value={dbSearch}
                    onChange={(e) => { setDbSearch(e.target.value); setDbPage(1); }}
                    placeholder="N° facture / contrat…"
                    style={{
                      width: "100%", padding: "9px 10px 9px 32px",
                      borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
                      background: "rgba(255,255,255,.08)", color: "white", fontSize: 13, outline: "none",
                    }}
                  />
                </div>

                <div style={{ position: "relative" }}>
                  <Calendar size={13} style={{ position: "absolute", left: 10, top: 11, color: "#94a3b8" }} />
                  <input
                    type="date"
                    value={dbDateStart}
                    onChange={(e) => { setDbDateStart(e.target.value); setDbPage(1); }}
                    style={{
                      width: "100%", padding: "9px 10px 9px 32px",
                      borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
                      background: "rgba(255,255,255,.08)", color: "white", fontSize: 13, outline: "none",
                    }}
                  />
                </div>

                <div style={{ position: "relative" }}>
                  <Calendar size={13} style={{ position: "absolute", left: 10, top: 11, color: "#94a3b8" }} />
                  <input
                    type="date"
                    value={dbDateEnd}
                    onChange={(e) => { setDbDateEnd(e.target.value); setDbPage(1); }}
                    style={{
                      width: "100%", padding: "9px 10px 9px 32px",
                      borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
                      background: "rgba(255,255,255,.08)", color: "white", fontSize: 13, outline: "none",
                    }}
                  />
                </div>

                <select
                  value={dbStatus}
                  onChange={(e) => { setDbStatus(e.target.value); setDbPage(1); }}
                  style={{
                    width: "100%", padding: "9px 10px",
                    borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
                    background: "rgba(255,255,255,.08)", color: "white", fontSize: 13, outline: "none",
                  }}
                >
                  <option value="" style={{ color: COLORS.navy }}>Tous statuts certif.</option>
                  <option value="CREATED" style={{ color: COLORS.navy }}>Créée</option>
                  <option value="VALIDATED" style={{ color: COLORS.navy }}>Validée</option>
                  <option value="CONTESTED" style={{ color: COLORS.navy }}>Contestée</option>
                </select>

                <select
                  value={dbPayStatus}
                  onChange={(e) => { setDbPayStatus(e.target.value); setDbPage(1); }}
                  style={{
                    width: "100%", padding: "9px 10px",
                    borderRadius: 10, border: "1px solid rgba(255,255,255,.15)",
                    background: "rgba(255,255,255,.08)", color: "white", fontSize: 13, outline: "none",
                  }}
                >
                  <option value="" style={{ color: COLORS.navy }}>Tous paiements</option>
                  <option value="PAID" style={{ color: COLORS.navy }}>Payée</option>
                  <option value="UNPAID" style={{ color: COLORS.navy }}>Impayée</option>
                  <option value="OUT_OF_SCOPE" style={{ color: COLORS.navy }}>Hors scope</option>
                </select>

                <button
                  onClick={handleDBExport}
                  disabled={dbExporting || (dbQ.data?.count ?? 0) === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "9px 14px", borderRadius: 10,
                    border: "none",
                    background: dbExporting || (dbQ.data?.count ?? 0) === 0 ? "rgba(255,255,255,.05)" : "#2563eb",
                    color: dbExporting || (dbQ.data?.count ?? 0) === 0 ? "#64748b" : "white",
                    fontWeight: 700, fontSize: 13,
                    cursor: dbExporting || (dbQ.data?.count ?? 0) === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {dbExporting
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <Download size={14} />}
                  {dbExporting ? "Export…" : "Exporter Excel"}
                </button>
              </div>
            </div>

            {/* Corps — tableau */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {dbQ.isLoading ? (
                <div style={{ display: "grid", placeItems: "center", padding: 60, color: COLORS.slate400, fontSize: 14 }}>
                  <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
                  Chargement des données…
                </div>
              ) : dbQ.isError ? (
                <div style={{ padding: 40, textAlign: "center", color: COLORS.red, fontSize: 14 }}>
                  Erreur lors du chargement. Veuillez réessayer.
                </div>
              ) : !dbQ.data || dbQ.data.results.length === 0 ? (
                <div style={{ padding: 60, textAlign: "center", color: COLORS.slate400, fontSize: 14 }}>
                  Aucune facture pour les filtres sélectionnés.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: COLORS.slate50, borderBottom: `2px solid ${COLORS.slate200}` }}>
                      {[
                        "N° Facture", "Contrat",
                        "Date compta.", "Début pér.", "Fin pér.",
                        "Certif.", "Paiement",
                        "Montant HT", "Montant TTC", "Cos φ",
                        "NRJ calc.", "Abonnement", "Pénalité",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: COLORS.slate500,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: ".05em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dbQ.data.results.map((inv, idx) => (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: `1px solid ${COLORS.slate100}`,
                          background: idx % 2 === 0 ? COLORS.white : COLORS.slate50,
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontFamily: "ui-monospace,monospace", color: COLORS.slate700 }}>
                          {inv.numero_facture || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "ui-monospace,monospace", color: COLORS.slate700 }}>
                          {inv.numero_compte_contrat || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: COLORS.slate700 }}>
                          {inv.date_comptable_facture || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: COLORS.slate700 }}>
                          {inv.date_debut_periode || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: COLORS.slate700 }}>
                          {inv.date_fin_periode || "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <StatusPill v={inv.status as any} />
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <PayPill value={inv.payment_status} updatedAt={inv.payment_status_updated_at} />
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: COLORS.navy }}>
                          {money((inv as any).montant_hors_tva)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", color: COLORS.blue }}>
                          {money((inv as any).montant_ttc)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap", color: COLORS.slate500 }}>
                          {money((inv as any).montant_cosinus_phi)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap", color: COLORS.green }}>
                          {money((inv as any).energie_calculee)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap", color: COLORS.amber }}>
                          {money((inv as any).abonnement_calcule)}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap", color: COLORS.red }}>
                          {money((inv as any).penalite_abonnement_calculee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination modal */}
            {(dbQ.data?.count ?? 0) > DB_PAGE_SIZE && (
              <div
                style={{
                  borderTop: `1px solid ${COLORS.slate200}`,
                  background: COLORS.slate50,
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13, color: COLORS.slate500 }}>
                  Page <strong style={{ color: COLORS.navy }}>{dbPage}</strong> /{" "}
                  <strong style={{ color: COLORS.navy }}>
                    {Math.ceil((dbQ.data?.count ?? 0) / DB_PAGE_SIZE)}
                  </strong>{" "}
                  — <strong style={{ color: COLORS.navy }}>{(dbQ.data?.count ?? 0).toLocaleString("fr-FR")}</strong> factures
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={dbPage <= 1}
                    onClick={() => setDbPage(dbPage - 1)}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: `1px solid ${COLORS.slate200}`, background: COLORS.white,
                      opacity: dbPage <= 1 ? 0.4 : 1,
                      cursor: dbPage <= 1 ? "not-allowed" : "pointer",
                      display: "grid", placeItems: "center",
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={dbPage >= Math.ceil((dbQ.data?.count ?? 0) / DB_PAGE_SIZE)}
                    onClick={() => setDbPage(dbPage + 1)}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: `1px solid ${COLORS.slate200}`, background: COLORS.white,
                      opacity: dbPage >= Math.ceil((dbQ.data?.count ?? 0) / DB_PAGE_SIZE) ? 0.4 : 1,
                      cursor: dbPage >= Math.ceil((dbQ.data?.count ?? 0) / DB_PAGE_SIZE) ? "not-allowed" : "pointer",
                      display: "grid", placeItems: "center",
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}