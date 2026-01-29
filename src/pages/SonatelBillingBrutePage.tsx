import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DataTable, Col } from "@/components/DataTable";
import { StatusPill, money, cn } from "@/features/sonatelBilling/ui";
import { listInvoices, SonatelInvoice } from "@/features/sonatelBilling/api";

type Tab = "INVOICES" | "MONTHLY" | "CONTRACT";

export default function SonatelBillingBrutePage() {
  const [tab, setTab] = useState<Tab>("INVOICES");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  // ✅ Invoices tab (données cibles)
  const invoicesQ = useQuery({
    queryKey: ["sb-invoices", { page, search, status }],
    queryFn: () => listInvoices({ page, page_size: 20, search, status }),
    placeholderData: keepPreviousData,
  });

  const invoiceCols: Col<SonatelInvoice>[] = useMemo(
    () => [
      {
        key: "site",
        title: "Site",
        render: (r) => (
          <div className="min-w-[180px]">
            <div className="font-semibold">{r.site?.site_id || "—"}</div>
            <div className="text-xs text-slate-500 truncate">{r.site?.name || ""}</div>
          </div>
        ),
      },
      { key: "contract", title: "Contrat", render: (r) => <span className="font-mono">{r.numero_compte_contrat}</span> },
      { key: "fact", title: "Facture", render: (r) => <span className="font-mono">{r.numero_facture}</span> },
      {
        key: "period",
        title: "Période",
        render: (r) => (
          <div className="text-xs">
            <div>{r.date_debut_periode}</div>
            <div className="text-slate-500">→ {r.date_fin_periode}</div>
          </div>
        ),
      },
      { key: "ht", title: "HT", render: (r) => money(r.montant_hors_tva), className: "whitespace-nowrap" },
      { key: "ttc", title: "TTC", render: (r) => money(r.montant_ttc), className: "whitespace-nowrap" },

      // ✅ Données cibles
      { key: "abo", title: "Abonnement", render: (r) => money(r.abonnement_calcule), className: "whitespace-nowrap" },
      { key: "pen", title: "PenPrime", render: (r) => money(r.penalite_abonnement_calculee), className: "whitespace-nowrap" },
      { key: "nrj", title: "NRJ", render: (r) => money(r.energie_calculee), className: "whitespace-nowrap" },

      { key: "status", title: "Statut", render: (r) => <StatusPill v={r.status} /> },
    ],
    []
  );

  const rows = invoicesQ.data?.results ?? [];
  const total = invoicesQ.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing Sonatel</h1>
          <p className="text-slate-500 mt-1">Factures + données cibles (Abonnement / PenPrime / NRJ) + statuts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setTab("INVOICES")}
          className={cn(
            "px-4 py-2 rounded-2xl border font-semibold",
            tab === "INVOICES" ? "bg-blue-900 text-white border-blue-900" : "bg-white border-slate-200 text-slate-700"
          )}
        >
          Factures
        </button>
        <button
          onClick={() => setTab("MONTHLY")}
          className={cn(
            "px-4 py-2 rounded-2xl border font-semibold",
            tab === "MONTHLY" ? "bg-blue-900 text-white border-blue-900" : "bg-white border-slate-200 text-slate-700"
          )}
        >
          Synthèse mensuelle
        </button>
        <button
          onClick={() => setTab("CONTRACT")}
          className={cn(
            "px-4 py-2 rounded-2xl border font-semibold",
            tab === "CONTRACT" ? "bg-blue-900 text-white border-blue-900" : "bg-white border-slate-200 text-slate-700"
          )}
        >
          Contrat × Mois
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Recherche (facture / contrat / compteur)…"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/20"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5"
        >
          <option value="">Tous statuts</option>
          <option value="CREATED">Créée</option>
          <option value="VALIDATED">Validée</option>
          <option value="CONTESTED">Contestée</option>
        </select>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-700">
          Total: <span className="font-semibold">{total.toLocaleString("fr-FR")}</span>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        {tab === "INVOICES" ? (
          <>
            <DataTable cols={invoiceCols} rows={rows} loading={invoicesQ.isLoading} />
            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Page <span className="font-semibold">{page}</span> / {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-2 rounded-2xl border border-slate-200 bg-white disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-2 rounded-2xl border border-slate-200 bg-white disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            OK — prochaine étape : je te mets les 2 autres tabs (Monthly + ContractMonth) avec les mêmes filtres + Site partout.
          </div>
        )}
      </div>
    </div>
  );
}
