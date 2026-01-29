import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { UploadCloud, RefreshCw } from "lucide-react";

import { DataTable, Col } from "@/components/DataTable";
import { StatusPill, money, num, cn } from "@/features/sonatelBilling/ui";
import { useAuth } from "@/auth/AuthContext";

// ✅ API existantes (factures + monthly + contract)
import {
  listInvoices,
  listMonthly,
  listContractMonths,
  SonatelInvoice,
  MonthlySynthesis,
  ContractMonth,
} from "@/features/sonatelBilling/api";

// ✅ Import API (batches/issues/import) — adapte le path si différent
import { getBatchIssues, importInvoices, listBatches, ImportIssue } from "@/features/sonatelBilling/admin/importApi";
import { SeverityPill } from "@/features/sonatelBilling/admin/ui";
import SonatelBillingStatsTab from "@/features/sonatelBilling/SonatelBillingStatsTab";

type Tab = "INVOICES" | "MONTHLY" | "CONTRACT" | "IMPORT"| "STATS";


function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}


// en haut du fichier (SonatelBillingPage.tsx)
function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function defaultRangeCurrentYear() {
  const now = new Date();
  return {
    start: fmtDate(new Date(now.getFullYear(), 0, 1)),
    end: fmtDate(now),
  };
}



function PaginationBar({
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
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-slate-500">
        Page <span className="font-semibold">{page}</span> / {totalPages} • Total{" "}
        <span className="font-semibold">{total.toLocaleString("fr-FR")}</span>
      </div>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="px-3 py-2 rounded-2xl border border-slate-200 bg-white disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="px-3 py-2 rounded-2xl border border-slate-200 bg-white disabled:opacity-40"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
      <div className="text-xs font-semibold tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

export default function SonatelBillingPage() {
  const { user } = useAuth();
  const role = user?.role || "analyst";
  const isAdmin = role === "admin";

  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("INVOICES");

  // filtres communs
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [site, setSite] = useState<string>(""); // site_id (code) si supporté
  const [page, setPage] = useState(1);

  // filtres mensuels
  const [year, setYear] = useState<string>("");
  const [month, setMonth] = useState<string>("");

  // ✅ NEW: filtre date commun (par défaut current year)
  const defRange = useMemo(() => defaultRangeCurrentYear(), []);
  const [dateStart, setDateStart] = useState(defRange.start);
  const [dateEnd, setDateEnd] = useState(defRange.end);


  const pageSize = 20;


  const tabs = useMemo(() => {
    const base: Array<{ key: Tab; label: string }> = [
      { key: "INVOICES", label: "Factures" },
      { key: "MONTHLY", label: "Synthèse mensuelle" },
      { key: "CONTRACT", label: "Contrat × Mois" },
      { key: "STATS", label: "Stats" }, // ✅ NEW
    ];
    if (isAdmin) base.push({ key: "IMPORT", label: "Import" });
    return base;
  }, [isAdmin]);


  // ======================
  // ✅ Invoices
  // ======================
  const invoicesQ = useQuery({
  enabled: tab === "INVOICES",
  queryKey: ["sb-invoices", { page, search, status, site, dateStart, dateEnd }],
  queryFn: () =>
    listInvoices({
      page,
      page_size: pageSize,
      search,
      status,
      site,
      start: dateStart,   // ✅ NEW
      end: dateEnd,       // ✅ NEW
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
      start: dateStart,   // ✅ NEW
      end: dateEnd,       // ✅ NEW
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
      start: dateStart,   // ✅ NEW
      end: dateEnd,       // ✅ NEW
    }),
  placeholderData: keepPreviousData,
});



  // ======================
  // ✅ Contract × Month
  // ======================
 

  // ======================
  // ✅ Columns
  // ======================
  const invoiceCols: Col<SonatelInvoice>[] = useMemo(
    () => [
      {
        key: "site",
        title: "Site",
        render: (r) => (
          <div className="min-w-[180px]">
            <div className="font-semibold">{(r as any)?.site?.site_id || (r as any)?.site_id || "—"}</div>
            <div className="text-xs text-slate-500 truncate">{(r as any)?.site?.name || (r as any)?.site_name || ""}</div>
          </div>
        ),
      },
      { key: "contract", title: "Contrat", render: (r) => <span className="font-mono">{r.numero_compte_contrat}</span> },
      { key: "fact", title: "Facture", render: (r) => <span className="font-mono">{r.numero_facture}</span> },
      {
        key: "period",
        title: "Période",
        render: (r) => (
          <div className="text-xs whitespace-nowrap">
            <div>{r.date_debut_periode || "—"}</div>
            <div className="text-slate-500">→ {r.date_fin_periode || "—"}</div>
          </div>
        ),
      },
      {
        key: "echeance",
        title: "Échéance",
        render: (r) => (r as any)?.echeance || "—",
        className: "whitespace-nowrap",
      },

      { key: "ht", title: "HT", render: (r) => money((r as any)?.montant_hors_tva), className: "whitespace-nowrap" },
      { key: "ttc", title: "TTC", render: (r) => money((r as any)?.montant_ttc), className: "whitespace-nowrap" },

      // ✅ Données cibles
      { key: "montant_cosinus_phi", title: "Montant Cosinus Phi", render: (r) => money((r as any)?.montant_cosinus_phi), className: "whitespace-nowrap" },
      { key: "abo", title: "Abonnement", render: (r) => money((r as any)?.abonnement_calcule), className: "whitespace-nowrap" },
      { key: "pen", title: "PenPrime", render: (r) => money((r as any)?.penalite_abonnement_calculee), className: "whitespace-nowrap" },
      { key: "nrj", title: "NRJ", render: (r) => money((r as any)?.energie_calculee), className: "whitespace-nowrap" },

      { key: "status", title: "Statut", render: (r) => <StatusPill v={(r as any)?.status} /> },
    ],
    []
  );

  const monthlyCols: Col<MonthlySynthesis>[] = useMemo(
    () => [
      {
        key: "site",
        title: "Site",
        render: (r) => (
          <div className="min-w-[190px]">
            <div className="font-semibold">{(r as any).site_id || "—"}</div>
            <div className="text-xs text-slate-500 truncate">{(r as any).site_name || ""}</div>
          </div>
        ),
      },
      { key: "contract", title: "Contrat", render: (r) => <span className="font-mono">{r.numero_compte_contrat}</span> },
      { key: "fact", title: "Facture", render: (r) => <span className="font-mono">{r.numero_facture}</span> },
      { key: "ym", title: "Mois", render: (r) => `${r.year}-${String(r.month).padStart(2, "0")}` },
      { key: "conso", title: "Conso", render: (r) => num((r as any).conso), className: "whitespace-nowrap" },
      { key: "ht", title: "HT", render: (r) => money((r as any).montant_hors_tva), className: "whitespace-nowrap" },
      { key: "ttc", title: "TTC", render: (r) => money((r as any).montant_ttc), className: "whitespace-nowrap" },
      { key: "abo", title: "Abonnement", render: (r) => money((r as any).abonnement_calcule), className: "whitespace-nowrap" },
      { key: "pen", title: "PenPrime", render: (r) => money((r as any).penalite_abonnement_calculee), className: "whitespace-nowrap" },
      { key: "nrj", title: "NRJ", render: (r) => money((r as any).energie_calculee), className: "whitespace-nowrap" },
      { key: "status", title: "Statut", render: (r) => <StatusPill v={(r as any).status} /> },
    ],
    []
  );

  const contractCols: Col<ContractMonth>[] = useMemo(
    () => [
      {
        key: "site",
        title: "Site",
        render: (r) => (
          <div className="min-w-[190px]">
            <div className="font-semibold">{(r as any).site_id || "—"}</div>
            <div className="text-xs text-slate-500 truncate">{(r as any).site_name || ""}</div>
          </div>
        ),
      },
      { key: "contract", title: "Contrat", render: (r) => <span className="font-mono">{r.numero_compte_contrat}</span> },
      { key: "ym", title: "Mois", render: (r) => `${r.year}-${String(r.month).padStart(2, "0")}` },
      { key: "count", title: "#Factures", render: (r) => (r as any).invoices_count, className: "whitespace-nowrap font-semibold" },
      { key: "conso", title: "Conso", render: (r) => num((r as any).conso), className: "whitespace-nowrap" },
      { key: "ht", title: "HT", render: (r) => money((r as any).montant_hors_tva), className: "whitespace-nowrap" },
      { key: "ttc", title: "TTC", render: (r) => money((r as any).montant_ttc), className: "whitespace-nowrap" },
      { key: "abo", title: "Abonnement", render: (r) => money((r as any).abonnement_calcule), className: "whitespace-nowrap" },
      { key: "pen", title: "PenPrime", render: (r) => money((r as any).penalite_abonnement_calculee), className: "whitespace-nowrap" },
      { key: "nrj", title: "NRJ", render: (r) => money((r as any).energie_calculee), className: "whitespace-nowrap" },
    ],
    []
  );

  // ======================
  // ✅ Active tab data
  // ======================
  const active = tab === "INVOICES" ? invoicesQ : tab === "MONTHLY" ? monthlyQ : tab === "CONTRACT" ? contractQ : null;
  const rows = ((active?.data as any)?.results ?? []) as any[];
  const total = (active?.data as any)?.count ?? 0;

  const kpi = useMemo(() => {
    const sum = (key: string) => rows.reduce((acc, r) => acc + (Number(r?.[key] ?? 0) || 0), 0);
    return {
      ttc: sum("montant_ttc"),
      ht: sum("montant_hors_tva"),
      nrj: sum("energie_calculee"),
      abo: sum("abonnement_calcule"),
      pen: sum("penalite_abonnement_calculee"),
    };
  }, [rows]);

  function resetPage(nextTab: Tab) {
    setTab(nextTab);
    setPage(1);
  }

  // ======================
  // ✅ IMPORT (Admin) — avec echeance (type date)
  // ======================
  const [file, setFile] = useState<File | null>(null);
  const [echeance, setEcheance] = useState<string>(""); // ✅ YYYY-MM-DD
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [severity, setSeverity] = useState<string>("");

  const batchesQ = useQuery({
    enabled: tab === "IMPORT" && isAdmin,
    queryKey: ["sb-batches", { kind: "SENELEC_INVOICE" }], // ⚠️ garde ton kind actuel
    queryFn: () => listBatches({ kind: "SENELEC_INVOICE", page: 1, page_size: 20 }),
    placeholderData: keepPreviousData,
  });

  const issuesQ = useQuery({
    enabled: tab === "IMPORT" && !!selectedBatchId && isAdmin,
    queryKey: ["sb-batch-issues", selectedBatchId, severity],
    queryFn: () => getBatchIssues(selectedBatchId!, severity ? { severity } : undefined),
    placeholderData: keepPreviousData,
  });

  const importMut = useMutation({
    mutationFn: ({ file, echeance }: { file: File; echeance: string }) => importInvoices(file, echeance),
    onSuccess: (res) => {
      toast.success(`Import OK: +${res.rows_created} / maj ${res.rows_updated} • issues ${res.issues_logged}`);
      setSelectedBatchId(res.batch.id);
      qc.invalidateQueries({ queryKey: ["sb-batches"] });
      qc.invalidateQueries({ queryKey: ["sb-invoices"] });
      qc.invalidateQueries({ queryKey: ["sb-monthly"] });
      qc.invalidateQueries({ queryKey: ["sb-contract-months"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Import échoué"),
  });

  const issueCols: Col<ImportIssue>[] = useMemo(
    () => [
      { key: "sev", title: "Niveau", render: (r) => <SeverityPill v={r.severity} /> },
      { key: "row", title: "Ligne", render: (r) => r.row_number ?? "—", className: "whitespace-nowrap font-semibold" },
      { key: "field", title: "Champ", render: (r) => r.field || "—", className: "whitespace-nowrap" },
      { key: "msg", title: "Message", render: (r) => <div className="min-w-[420px]">{r.message}</div> },
    ],
    []
  );

  const lastBatches = (batchesQ.data as any)?.results ?? [];
  const issues = (issuesQ.data as any) ?? [];



  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Billing Sonatel</h1>
            <p className="text-slate-500 mt-1">
              Factures • Synthèse mensuelle • Contrat × Mois — Données cibles (Abonnement / PenPrime / NRJ)
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => resetPage(t.key)}
              className={cn(
                "px-4 py-2 rounded-2xl border font-semibold transition",
                tab === t.key
                  ? "bg-blue-900 text-white border-blue-900"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters (pas pour IMPORT) */}
        {/* Filters */}
        {tab !== "IMPORT" ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
            {/* Search/site/status uniquement hors STATS */}
            {tab !== "STATS" ? (
              <>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={tab === "INVOICES" ? "Recherche (facture/contrat/compteur)…" : "Contrat (num) …"}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                />

                <input
                  value={site}
                  onChange={(e) => {
                    setSite(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Site (code) ex: S001"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5"
                />

                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5"
                >
                  <option value="">Tous statuts</option>
                  <option value="CREATED">Créée</option>
                  <option value="VALIDATED">Validée</option>
                  <option value="CONTESTED">Contestée</option>
                </select>
              </>
            ) : (
              // petit spacer pour garder la grille alignée
              <div className="md:col-span-3" />
            )}

            {/* Dates : partout sauf IMPORT */}
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
              <div className="text-[11px] font-bold text-slate-500">Date début</div>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
              <div className="text-[11px] font-bold text-slate-500">Date fin</div>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => {
                  setDateEnd(e.target.value);
                  setPage(1);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-semibold"
              />
            </div>
          </div>
        ) : null}


      </div>

      {/* KPI (pas pour IMPORT) */}
      {tab !== "IMPORT" && tab !== "STATS" ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <KpiCard title="TTC (page)" value={money(String(kpi.ttc))} />
          <KpiCard title="HT (page)" value={money(String(kpi.ht))} />
          <KpiCard title="NRJ (page)" value={money(String(kpi.nrj))} />
          <KpiCard title="Abonnement (page)" value={money(String(kpi.abo))} />
          <KpiCard title="PenPrime (page)" value={money(String(kpi.pen))} />
        </div>
      ) : null}

      {/* Content */}
      <div className="mt-4">
        { tab === "STATS" ? (
            <SonatelBillingStatsTab start={dateStart} end={dateEnd} />
          ) : tab === "INVOICES" ? (
          <>
            <DataTable cols={invoiceCols} rows={rows as SonatelInvoice[]} loading={invoicesQ.isLoading} />
            <PaginationBar page={page} total={total} pageSize={pageSize} onPage={setPage} />
          </>
        ) : tab === "MONTHLY" ? (
          <>
            <DataTable cols={monthlyCols} rows={rows as MonthlySynthesis[]} loading={monthlyQ.isLoading} />
            <PaginationBar page={page} total={total} pageSize={pageSize} onPage={setPage} />
          </>
        ) : tab === "CONTRACT" ? (
          <>
            <DataTable cols={contractCols} rows={rows as ContractMonth[]} loading={contractQ.isLoading} />
            <PaginationBar page={page} total={total} pageSize={pageSize} onPage={setPage} />
          </>
        ) : (
          // ======================
          // ✅ IMPORT TAB (Admin)
          // ======================
          <div className="space-y-4">
            {!isAdmin ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
                Accès réservé Admin.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Import Factures (Excel)</h2>
                      <p className="text-slate-500 mt-1">
                        Upload Sonatel → upsert factures + synthèse mensuelle + recalcul Contrat×Mois.
                      </p>
                    </div>

                    <button
                      onClick={() => batchesQ.refetch()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Rafraîchir
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold text-slate-500">Fichier</div>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="mt-2 block w-full text-sm"
                      />
                      {file ? <div className="mt-2 text-xs text-slate-500">{file.name}</div> : null}
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold text-slate-500">Échéance (obligatoire)</div>
                      <input
                        type="date"
                        value={echeance}
                        onChange={(e) => setEcheance(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 font-semibold"
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="text-xs font-semibold text-slate-500">Derniers batches</div>
                      <select
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2"
                        value={selectedBatchId ?? ""}
                        onChange={(e) => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">— sélectionner —</option>
                        {lastBatches.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            #{b.id} • {new Date(b.imported_at).toLocaleString("fr-FR")} • {b.source_filename}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-end">
                      <button
                        disabled={!file || !echeance || importMut.isPending}
                        onClick={() => file && echeance && importMut.mutate({ file, echeance })}
                        className={cn(
                          "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-extrabold",
                          "bg-blue-900 text-white border border-blue-900",
                          (!file || !echeance || importMut.isPending) ? "opacity-50 cursor-not-allowed" : "hover:opacity-95"
                        )}
                      >
                        <UploadCloud className="h-5 w-5" />
                        {importMut.isPending ? "Import..." : "Importer"}
                      </button>
                    </div>
                  </div>

                  {importMut.data ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
                      <Stat label="Créées" value={importMut.data.rows_created} />
                      <Stat label="Mises à jour" value={importMut.data.rows_updated} />
                      <Stat label="Monthly créées" value={importMut.data.monthly_rows_created} />
                      <Stat label="Issues" value={importMut.data.issues_logged} />
                      <Stat label="Missing Site" value={importMut.data.invoices_missing_site_count} />
                      <Stat label="Contrat×Mois upsert" value={importMut.data.contract_months_upserted} />
                    </div>
                  ) : null}

                  {importMut.data?.invoices_missing_site_count ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                      <div className="font-semibold">Attention : contrats sans mapping Site</div>
                      <div className="text-sm mt-1">
                        Exemples: {importMut.data.invoices_missing_site_sample?.join(", ") || "—"}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(2,6,23,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-extrabold text-slate-900">Issues du batch</h3>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-semibold"
                    >
                      <option value="">Tous</option>
                      <option value="ERROR">ERROR</option>
                      <option value="WARN">WARN</option>
                      <option value="INFO">INFO</option>
                    </select>
                  </div>

                  <div className="mt-3">
                    <DataTable
                      cols={issueCols}
                      rows={issues}
                      loading={issuesQ.isLoading}
                      emptyText={selectedBatchId ? "Aucune issue" : "Sélectionne un batch pour voir les issues"}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
