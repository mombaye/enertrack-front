import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Calculator, ArrowRight, BadgeCheck } from "lucide-react";
import { computeBill } from "@/features/sonatelBilling/admin/api";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">{children}</div>;
}

export default function BillingComputePage() {
  const [contract, setContract] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [k1, setK1] = useState("");
  const [k2, setK2] = useState("");
  const [category, setCategory] = useState(""); // optionnel

  const m = useMutation({
    mutationFn: () =>
      computeBill({
        contract: contract.trim(),
        date,
        k1: k1.trim() || undefined,
        k2: k2.trim() || undefined,
        category: category.trim() || undefined,
      }),
    onSuccess: () => toast.success("Simulation OK."),
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Simulation impossible."),
  });

  const res = m.data as any;

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-sm">
            <Calculator className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-slate-900">Simulation facture</div>
            <div className="text-sm text-slate-600">
              Contrat + Date + Conso K1/K2 → applique le tarif et calcule le total.
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <div className="p-6 space-y-4">
            <div className="text-sm font-semibold text-slate-700">Entrées</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Contrat</div>
                <input
                  value={contract}
                  onChange={(e) => setContract(e.target.value)}
                  placeholder="ex: 22001513021"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none hover:border-slate-300"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Date</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none hover:border-slate-300"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Conso K1</div>
                <input
                  value={k1}
                  onChange={(e) => setK1(e.target.value)}
                  placeholder="ex: 1200,5"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none hover:border-slate-300"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Conso K2</div>
                <input
                  value={k2}
                  onChange={(e) => setK2(e.target.value)}
                  placeholder="ex: 300"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none hover:border-slate-300"
                />
              </div>

              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  Catégorie tarifaire (optionnel)
                </div>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="ex: DGP (si Site.billing_typology n’est pas renseigné)"
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none hover:border-slate-300"
                />
                <div className="mt-1 text-xs text-slate-500">
                  Si vide, le backend tente <b>Site.billing_typology</b> puis <b>Site.contratual_typology</b>.
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!contract.trim()) return toast.error("Entre un numéro de contrat.");
                m.mutate();
              }}
              disabled={m.isPending}
              className="w-full px-4 py-2 rounded-2xl bg-blue-900 text-white font-semibold hover:bg-blue-800 disabled:opacity-60 shadow-sm"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {m.isPending ? "Calcul…" : "Calculer"}
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </Card>

        {/* Result */}
        <Card>
          <div className="p-6 space-y-4">
            <div className="text-sm font-semibold text-slate-700">Résultat</div>

            {!res ? (
              <div className="text-sm text-slate-500">
                Lance une simulation pour voir le site, le tarif appliqué et le total.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <BadgeCheck className="h-4 w-4" />
                    Contrat {res.contract} → Site {res.site?.site_id} ({res.site?.name})
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Catégorie: <b>{res.category}</b> | Date: <b>{res.date}</b>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Tarif appliqué</div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">K1</div>
                      <div className="font-semibold">{res.tariff?.energie_k1}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">K2</div>
                      <div className="font-semibold">{res.tariff?.energie_k2}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Prime fixe</div>
                      <div className="font-semibold">{res.tariff?.prime_fixe}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold text-slate-500 mb-2">Calcul</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>K1 amount</span>
                      <b>{res.breakdown?.k1_amount}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>K2 amount</span>
                      <b>{res.breakdown?.k2_amount}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Prime fixe</span>
                      <b>{res.breakdown?.prime_fixe}</b>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-900">
                      <span className="font-semibold">TOTAL</span>
                      <span className="font-semibold">{res.breakdown?.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
