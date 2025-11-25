// src/pages/SonatelBillingPage.tsx
import React from "react";
import { Upload, FileSpreadsheet, Layers, BarChart3, RefreshCw, Search, Calendar, Filter } from "lucide-react";
import { toast } from "react-toastify";
import {
  importSonatelFile,
  listBatches,
  listInvoices,
  listMonthly,
  ImportBatch,
  SonatelInvoice,
  MonthlyRow,
} from "@/services/sonatelBilling";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from "recharts";

type TabKey = "import" | "records" | "monthly";

export default function SonatelBillingPage() {
  const [tab, setTab] = React.useState<TabKey>("import");

  return (
    <div className="p-4 md:p-6">
      <Header />
      {/*<TabBar current={tab} onChange={setTab} />*/}
      <div className="mt-6">
        {tab === "import" && <ImportSection />}
        {tab === "records" && <RecordsSection />}
        {tab === "monthly" && <MonthlySection />}
      </div>
    </div>
  );
}

/* ---------- UI: Header & Tabs ---------- */
function Header() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-blue-900">Billing Sonatel</h1>
        <p className="text-slate-500">Import Excel • Historique brut • Synthèse mensuelle</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">EnerTrack · Utilities</span>
      </div>
    </div>
  );
}

function TabBar({ current, onChange }: { current: TabKey; onChange: (k: TabKey) => void }) {
  const items: Array<{ k: TabKey; label: string; icon: React.ReactNode }> = [
    { k: "import", label: "Import", icon: <Upload className="h-4 w-4" /> },
    { k: "records", label: "Factures (brut)", icon: <FileSpreadsheet className="h-4 w-4" /> },
    { k: "monthly", label: "Synthèse mensuelle", icon: <BarChart3 className="h-4 w-4" /> },
  ];
  return (
    <div className="flex bg-white rounded-2xl border border-slate-200 p-1 shadow-sm w-full overflow-x-auto">
      {items.map((it) => (
        <button
          key={it.k}
          onClick={() => onChange(it.k)}
          className={[
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition",
            current === it.k ? "bg-blue-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          {it.icon} {it.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Import Section ---------- */
function ImportSection() {
  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [batches, setBatches] = React.useState<ImportBatch[]>([]);

  const refresh = React.useCallback(async () => {
    const data = await listBatches();
    setBatches(data);
  }, []);

  React.useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const onImport = async () => {
    if (!file) {
      toast.error("Choisis un fichier Excel d’abord.");
      return;
    }
    try {
      setLoading(true);
      const res = await importSonatelFile(file);
      toast.success(`Import OK: ${res.rows_created} lignes (batch ${res.batch.id})`);
      setFile(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Échec import");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-5">
      {/* uploader */}
      <div className="md:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-blue-900 mb-2">Uploader un fichier Sonatel</h3>
          <p className="text-sm text-slate-500 mb-4">
            Formats supportés : <span className="font-mono">.xlsx</span>, <span className="font-mono">.xls</span>.
          </p>
          <label className="block">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-blue-900 file:px-4 file:py-2 file:text-white hover:file:bg-blue-800"
            />
          </label>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onImport}
              disabled={!file || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Importer
            </button>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Rafraîchir
            </button>
          </div>
          {file && <p className="mt-2 text-xs text-slate-500 truncate">Fichier sélectionné : {file.name}</p>}
        </div>
      </div>

      {/* batches */}
      <div className="md:col-span-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-blue-900">Historique des imports</h3>
            <button onClick={refresh} className="rounded-xl border px-3 py-1.5 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[380px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Fichier</th>
                  <th className="text-left p-2">Importé le</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-slate-50">
                    <td className="p-2">{b.id}</td>
                    <td className="p-2">{b.source_filename}</td>
                    <td className="p-2">{format(new Date(b.imported_at), "dd/MM/yyyy HH:mm")}</td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={3}>
                      Aucun import pour le moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Records Section ---------- */
function RecordsSection() {
  const [rows, setRows] = React.useState<SonatelInvoice[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listInvoices({ search });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    fetchRows().catch(() => {});
  }, [fetchRows]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-900" />
          <h3 className="font-semibold text-blue-900">Factures (données brutes)</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher: facture, compte, compteur…"
              className="pl-9 pr-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <button onClick={fetchRows} className="rounded-xl border px-3 py-2 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[70vh] border-t">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-slate-600">
              <th className="p-2 text-left">Facture</th>
              <th className="p-2 text-left">Compte</th>
              <th className="p-2 text-left">Période</th>
              <th className="p-2 text-right">Conso</th>
              <th className="p-2 text-right">Énergie</th>
              <th className="p-2 text-right">TTC</th>
              <th className="p-2 text-left">Agence</th>
              <th className="p-2 text-left">Compteur</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-medium">{r.numero_facture}</td>
                  <td className="p-2">{r.numero_compte_contrat}</td>
                  <td className="p-2">
                    {format(new Date(r.date_debut_periode), "dd/MM/yyyy")} →{" "}
                    {format(new Date(r.date_fin_periode), "dd/MM/yyyy")}
                  </td>
                  <td className="p-2 text-right">{fmt(r.conso_facturee)}</td>
                  <td className="p-2 text-right">{fmt(r.montant_total_energie)}</td>
                  <td className="p-2 text-right">{fmt(r.montant_ttc)}</td>
                  <td className="p-2">{r.agence || "-"}</td>
                  <td className="p-2">{r.numero_compteur || "-"}</td>
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={8}>
                  Aucun enregistrement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Monthly Section (filtres + graphe + table) ---------- */
function MonthlySection() {
  const [year, setYear] = React.useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = React.useState<string>("");
  const [account, setAccount] = React.useState<string>("");
  const [facture, setFacture] = React.useState<string>("");

  const [rows, setRows] = React.useState<MonthlyRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMonthly({
        year: year || undefined,
        month: month || undefined,
        account: account || undefined,
        facture: facture || undefined,
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [year, month, account, facture]);

  React.useEffect(() => {
    fetchRows().catch(() => {});
  }, [fetchRows]);

  // Agrégats par mois (pour le graphe)
  const chartData = React.useMemo(() => {
    const map = new Map<string, { monthLabel: string; conso: number; energie: number; ttc: number }>();
    for (const r of rows) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      const obj = map.get(key) || { monthLabel: key, conso: 0, energie: 0, ttc: 0 };
      obj.conso += toNum(r.conso);
      obj.energie += toNum(r.montant_energie);
      obj.ttc += toNum(r.montant_ttc);
      map.set(key, obj);
    }
    return Array.from(map.values()).sort((a, b) => (a.monthLabel > b.monthLabel ? 1 : -1));
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-blue-900" />
          <h3 className="font-semibold text-blue-900">Filtres</h3>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <TextField value={year} onChange={setYear} placeholder="Année (ex: 2025)" icon={<Calendar className="h-4 w-4" />} />
          <TextField value={month} onChange={setMonth} placeholder="Mois (1-12)" icon={<Calendar className="h-4 w-4" />} />
          <TextField value={account} onChange={setAccount} placeholder="Compte contrat" />
          <TextField value={facture} onChange={setFacture} placeholder="N° facture" />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button onClick={fetchRows} className="rounded-xl bg-blue-900 px-4 py-2 text-white hover:bg-blue-800 inline-flex items-center gap-2">
            <Search className="h-4 w-4" /> Rechercher
          </button>
          <button
            onClick={() => {
              setYear(String(new Date().getFullYear()));
              setMonth("");
              setAccount("");
              setFacture("");
            }}
            className="rounded-xl border px-4 py-2 hover:bg-slate-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Graphes */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Montant TTC par mois">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis />
                <RTooltip />
                <Legend />
                <Bar dataKey="ttc" name="TTC" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Énergie / Conso par mois">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" />
                <YAxis />
                <RTooltip />
                <Legend />
                <Bar dataKey="energie" name="Montant énergie" />
                <Bar dataKey="conso" name="Conso" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 font-semibold text-blue-900">Détails synthèse (lignes proratisées)</div>
        <div className="overflow-auto max-h-[70vh] border-t">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                <th className="p-2 text-left">Compte</th>
                <th className="p-2 text-left">Facture</th>
                <th className="p-2 text-left">Année</th>
                <th className="p-2 text-left">Mois</th>
                <th className="p-2 text-right">Jours couverts</th>
                <th className="p-2 text-right">Conso</th>
                <th className="p-2 text-right">Énergie</th>
                <th className="p-2 text-right">TTC</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-500">
                    Chargement…
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    <td className="p-2">{r.numero_compte_contrat}</td>
                    <td className="p-2">{r.numero_facture}</td>
                    <td className="p-2">{r.year}</td>
                    <td className="p-2">{String(r.month).padStart(2, "0")}</td>
                    <td className="p-2 text-right">
                      {r.days_covered}/{r.days_in_month}
                    </td>
                    <td className="p-2 text-right">{fmt(r.conso)}</td>
                    <td className="p-2 text-right">{fmt(r.montant_energie)}</td>
                    <td className="p-2 text-right">{fmt(r.montant_ttc)}</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-slate-500" colSpan={8}>
                    Aucun résultat pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Small UI helpers ---------- */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="font-semibold text-blue-900 mb-2">{title}</div>
      {children}
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200",
          icon ? "pl-9" : "",
        ].join(" ")}
      />
    </div>
  );
}

function toNum(x?: string | null) {
  if (!x) return 0;
  // backend renvoie des strings décimales → parse float
  const n = Number(x);
  return isNaN(n) ? 0 : n;
}

function fmt(x?: string | null) {
  const n = toNum(x);
  return n ? n.toLocaleString("fr-FR") : "-";
}
