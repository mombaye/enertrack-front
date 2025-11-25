import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import clsx from "clsx";

// Types (adapte si besoin)
type KPI = {
  site_id: number;
  site_name: string;
  kpi_last_3_months: { avg_montant_ttc: number; avg_consommation_kwh: number; avg_montant_ht: number };
  kpi_current_year: { avg_montant_ttc: number; avg_consommation_kwh: number; avg_montant_ht: number };
  kpi_previous_year: { avg_montant_ttc: number; avg_consommation_kwh: number; avg_montant_ht: number };
};

type KPIPageTabProps = {
  kpi: KPI[];
  loading: boolean;
};

export default function KPIPageTab({ kpi, loading }: KPIPageTabProps) {
  // Recherche & filtre
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Liste des sites pour filtre
  const siteOptions = useMemo(
    () => Array.from(new Set(kpi.map(site => site.site_name))).sort(),
    [kpi]
  );

  // Filtrage/search
  const filteredKpi = useMemo(() => {
    return kpi.filter(site =>
      (!siteFilter || site.site_name === siteFilter) &&
      (!search ||
        site.site_name.toLowerCase().includes(search.toLowerCase()) ||
        site.site_id.toString().includes(search)
      )
    );
  }, [kpi, search, siteFilter]);

  // Pagination
  const paginatedKpi = useMemo(
    () => filteredKpi.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [filteredKpi, page, rowsPerPage]
  );

  // Graphs
  const montantData = filteredKpi.map(site => ({
    site: site.site_name,
    "3 derniers mois": Math.round(site.kpi_last_3_months.avg_montant_ttc),
    "Année en cours": Math.round(site.kpi_current_year.avg_montant_ttc),
    "Année précédente": Math.round(site.kpi_previous_year.avg_montant_ttc),
  }));

  const consoData = filteredKpi.map(site => ({
    site: site.site_name,
    "3 derniers mois": Math.round(site.kpi_last_3_months.avg_consommation_kwh),
    "Année en cours": Math.round(site.kpi_current_year.avg_consommation_kwh),
    "Année précédente": Math.round(site.kpi_previous_year.avg_consommation_kwh),
  }));

  // Reset page si filtre change
  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(0);
  }
  function handleSiteFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    setSiteFilter(e.target.value);
    setPage(0);
  }

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] py-8">
        <svg className="animate-spin h-10 w-10 text-blue-900 mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-blue-900 text-lg font-medium">Chargement des KPI en cours…</span>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="text-2xl font-bold text-blue-900 mb-4">
        KPI par site <span className="text-base font-normal text-blue-600">(3 derniers mois, année en cours, année précédente)</span>
      </div>

      {/* GRAPHS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card className="rounded-2xl shadow-xl p-6">
          <div className="text-lg font-semibold mb-4 text-blue-900">Comparaison Montant TTC</div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={montantData}>
              <XAxis dataKey="site" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="3 derniers mois" fill="#3b82f6" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Année en cours" fill="#f59e42" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Année précédente" fill="#22c55e" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="rounded-2xl shadow-xl p-6">
          <div className="text-lg font-semibold mb-4 text-blue-900">Comparaison Consommation kWh</div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={consoData}>
              <XAxis dataKey="site" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="3 derniers mois" fill="#3b82f6" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Année en cours" fill="#f59e42" radius={[10, 10, 0, 0]} />
              <Bar dataKey="Année précédente" fill="#22c55e" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Barre recherche/filtre */}
      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="🔎 Rechercher site ou N°"
          className="border rounded-xl px-3 py-2 shadow-sm focus:outline-blue-700 text-blue-900"
          value={search}
          onChange={handleSearch}
        />
        <select
          className="border rounded-xl px-3 py-2 shadow-sm text-blue-900"
          value={siteFilter}
          onChange={handleSiteFilter}
        >
          <option value="">Tous les sites</option>
          {siteOptions.map(site => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white p-4 rounded-2xl shadow-xl overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="bg-blue-50 text-blue-900">
              <th className="text-left px-4 py-2 rounded-t-xl">Site</th>
              <th className="text-center px-2 py-2">Montant TTC (3 mois)</th>
              <th className="text-center px-2 py-2">Montant TTC (Année)</th>
              <th className="text-center px-2 py-2">Montant TTC (N-1)</th>
              <th className="text-center px-2 py-2">Conso kWh (3 mois)</th>
              <th className="text-center px-2 py-2">Conso kWh (Année)</th>
              <th className="text-center px-2 py-2">Conso kWh (N-1)</th>
            </tr>
          </thead>
          <tbody>
            {paginatedKpi.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-blue-900 py-8">
                  Aucun résultat pour ce filtre.
                </td>
              </tr>
            ) : (
              paginatedKpi.map(site => (
                <tr key={site.site_id} className="hover:bg-blue-50 transition">
                  <td className="font-medium px-4 py-2">{site.site_name}</td>
                  <td className="text-center px-2 py-2">{site.kpi_last_3_months.avg_montant_ttc?.toLocaleString()}</td>
                  <td className="text-center px-2 py-2">{site.kpi_current_year.avg_montant_ttc?.toLocaleString()}</td>
                  <td className="text-center px-2 py-2">{site.kpi_previous_year.avg_montant_ttc?.toLocaleString()}</td>
                  <td className="text-center px-2 py-2">{site.kpi_last_3_months.avg_consommation_kwh?.toLocaleString()}</td>
                  <td className="text-center px-2 py-2">{site.kpi_current_year.avg_consommation_kwh?.toLocaleString()}</td>
                  <td className="text-center px-2 py-2">{site.kpi_previous_year.avg_consommation_kwh?.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
          <div className="text-blue-900 text-sm">
            {filteredKpi.length} résultat(s)
          </div>
          <div className="flex gap-2 items-center">
            <select
              className="border rounded-xl px-2 py-1"
              value={rowsPerPage}
              onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            >
              {[10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
            <button className={clsx("px-3 py-1 text-blue-900 rounded-xl hover:bg-blue-100", { "opacity-50 cursor-not-allowed": page === 0 })}
              onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>
              ←
            </button>
            <span className="text-blue-900">{page + 1} / {Math.max(1, Math.ceil(filteredKpi.length / rowsPerPage))}</span>
            <button className={clsx("px-3 py-1 text-blue-900 rounded-xl hover:bg-blue-100", { "opacity-50 cursor-not-allowed": (page + 1) * rowsPerPage >= filteredKpi.length })}
              onClick={() => setPage(p => Math.min(p + 1, Math.ceil(filteredKpi.length / rowsPerPage) - 1))}
              disabled={(page + 1) * rowsPerPage >= filteredKpi.length}>
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
