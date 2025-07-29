import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { Upload } from "lucide-react";
import { fetchInvoices, fetchInvoiceStats, importInvoicesExcel } from "@/services/invoices";
import InvoicesTable from "@/components/invoices/InvoicesTable";
import StatsTable from "@/components/invoices/StatsTable";
import { toast } from "react-toastify";

const now = new Date();
const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
const startOfYear = new Date(now.getFullYear(), 0, 1);

export default function InvoicesPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>({
    from: threeMonthsAgo,
    to: now,
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // Calcul stats globales
  const avgMontantGlobal = stats.length ? Math.round(stats.reduce((a, s) => a + (Number(s.avg_montant_ht) || 0), 0) / stats.length) : 0;
  const avgConsoGlobal = stats.length ? Math.round(stats.reduce((a, s) => a + (Number(s.avg_consommation) || 0), 0) / stats.length) : 0;
  const countGlobal = stats.reduce((a, s) => a + (Number(s.count) || 0), 0);

  useEffect(() => {
    if (!dateRange) return;
    setLoading(true);
    Promise.all([
      fetchInvoices({
        startDate: dateRange.from.toISOString().slice(0, 10),
        endDate: dateRange.to.toISOString().slice(0, 10),
      }),
      fetchInvoiceStats({
        startDate: dateRange.from.toISOString().slice(0, 10),
        endDate: dateRange.to.toISOString().slice(0, 10),
      }),
    ])
      .then(([invoicesRes, statsRes]) => {
        setInvoices(invoicesRes);
        setStats(statsRes);
      })
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false));
  }, [dateRange]);

  function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    importInvoicesExcel(file)
      .then(() => {
        toast.success("Import réussi !");
        // Refresh
        setTimeout(() => {
          if (dateRange)
            fetchInvoices({
              startDate: dateRange.from.toISOString().slice(0, 10),
              endDate: dateRange.to.toISOString().slice(0, 10),
            }).then(setInvoices);
        }, 700);
      })
      .catch(() => toast.error("Échec import Excel"))
      .finally(() => setImportLoading(false));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-end justify-between sticky top-0 z-30 bg-blue-50 pb-4 pt-2 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900 mb-1">Factures énergie</h1>
          <div className="text-blue-900/60 text-sm font-medium mb-2">
            Visualisez, importez et analysez vos factures d’énergie par site, période ou globalement.
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            presets={[
              { label: "3 derniers mois", getRange: () => ({ from: threeMonthsAgo, to: now }) },
              { label: "Année en cours", getRange: () => ({ from: startOfYear, to: now }) },
            ]}
          />
          <label className="inline-flex items-center cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              hidden
              disabled={importLoading}
            />
            <Button
              variant="outline"
              className="gap-2 min-w-[150px]"
              disabled={importLoading}
              asChild
            >
              <span>
                {importLoading ? (
                  <svg className="animate-spin inline h-5 w-5 mr-2 text-blue-900" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <Upload size={18} className="inline mr-2" />
                )}
                Importer Excel
              </span>
            </Button>
          </label>
        </div>
      </div>

      <Tabs defaultValue="factures" className="w-full">
        <TabsList>
          <TabsTrigger value="factures">📄 Historique</TabsTrigger>
          <TabsTrigger value="stats">📊 Stats moyennes par site</TabsTrigger>
        </TabsList>

        <TabsContent value="factures" className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-7 w-7 text-blue-900" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : (
            <InvoicesTable invoices={invoices} />
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-8">
          <div className="bg-blue-800 text-white rounded-2xl p-4 mb-6 flex gap-12 items-center shadow-lg">
            <div>
              <div className="text-lg font-semibold">Montant moyen global</div>
              <div className="text-2xl font-bold">{avgMontantGlobal ? avgMontantGlobal.toLocaleString() + " FCFA" : "--"}</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Conso moyenne globale</div>
              <div className="text-2xl font-bold">{avgConsoGlobal ? avgConsoGlobal.toLocaleString() + " kWh" : "--"}</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Factures analysées</div>
              <div className="text-2xl font-bold">{countGlobal || "--"}</div>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-7 w-7 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          ) : (
            <StatsTable stats={stats} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
