import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Site, createSite, updateSite } from "@/services/sites";
import { toast } from "react-toastify";

const ZONES = [
  { value: "DKR", label: "Dakar" },
  { value: "THS", label: "Thiès" },
  { value: "NDM", label: "Ndian" },
  // ...
];
const COUNTRIES = [
  { value: "sen", label: "Sénégal" },
  { value: "civ", label: "Côte d’Ivoire" },
  // ...
];

type SiteForm = {
  site_id: string;
  name: string;
  zone?: string;
  country?: string;
  real_typology?: string;
  is_billed?: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (site: Site) => void;
  initial?: Partial<Site>;
  mode?: "add" | "edit";
}

function toSiteForm(obj: Partial<Site> | undefined): SiteForm | undefined {
  if (!obj) return undefined;
  return {
    site_id: obj.site_id ?? "",
    name: obj.name ?? "",
    zone: obj.zone ?? undefined,
    country: obj.country ?? undefined,
    real_typology: obj.real_typology ?? undefined,
    is_billed: obj.is_billed ?? undefined,
  };
}



export function SiteModal({ open, onOpenChange, onSaved, initial, mode = "add" }: Props) {
  const { register, handleSubmit, setValue, reset, formState: { isSubmitting } } = useForm<SiteForm>({
    defaultValues: toSiteForm(initial),
 }); 

  useEffect(() => {
    if (initial) reset(toSiteForm(initial));
    // eslint-disable-next-line
  }, [initial]);

  async function onSubmit(data: SiteForm) {
    try {
      let saved: Site;
      if (mode === "edit" && initial?.id) {
        saved = await updateSite(initial.id, data);
        toast.success("Site modifié !");
      } else {
        saved = await createSite(data);
        toast.success("Site ajouté !");
      }
      onSaved(saved);
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Modifier un site" : "Ajouter un site"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
            <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="site_id">
                ID du site
            </label>
            <Input id="site_id" placeholder="Ex : DKR_0001" {...register("site_id", { required: true })} />
            </div>

            <div>
            <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="name">
                Nom du site
            </label>
            <Input id="name" placeholder="Nom" {...register("name", { required: true })} />
            </div>

            <Select value={initial?.zone ?? ""} onValueChange={v => setValue("zone", v)}>
              <SelectTrigger><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                {ZONES.map(z => (
                  <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={initial?.country ?? ""} onValueChange={v => setValue("country", v)}>
              <SelectTrigger><SelectValue placeholder="Pays" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
            <label className="block text-sm font-medium text-blue-900 mb-1" htmlFor="name">
                Nom du site
            </label>
            <Input id="name" placeholder="Nom" {...register("name", { required: true })} />
            </div>
          </div>
          <div>
            <label className="inline-flex items-center gap-2 mt-2">
              <input type="checkbox" {...register("is_billed")} />
              Site facturé
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Annuler</Button>
            </DialogClose>
           <Button type="submit" disabled={isSubmitting} className="bg-blue-900 text-white rounded-xl flex items-center gap-2">
            {isSubmitting && (
                <svg className="animate-spin h-4 w-4 mr-1 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
            )}
            {mode === "edit" ? "Enregistrer" : "Ajouter"}
            </Button>


          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
