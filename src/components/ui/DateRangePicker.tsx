import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";

type Range = DateRange | null;
type Preset = { label: string; getRange: () => Range };

interface DateRangePickerProps {
  value: Range;
  onChange: (v: Range) => void;
  presets?: Preset[];
}

export function DateRangePicker({ value, onChange, presets }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [tempRange, setTempRange] = React.useState<Range>(value);

  // Met à jour la sélection temporaire si la valeur initiale change
  React.useEffect(() => {
    setTempRange(value);
  }, [value]);

  function getLabel() {
    if (!value?.from || !value?.to) return "Choisir une période";
    if (format(value.from, "yyyy-MM-dd") === format(value.to, "yyyy-MM-dd")) {
      return format(value.from, "dd/MM/yyyy", { locale: fr });
    }
    return `${format(value.from, "dd/MM/yyyy", { locale: fr })} → ${format(value.to, "dd/MM/yyyy", { locale: fr })}`;
  }

  function handlePreset(preset: Preset) {
    const presetRange = preset.getRange();
    setTempRange(presetRange);
    onChange(presetRange);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 text-blue-900 border-blue-900 bg-white">
          <CalendarDays size={18} />
          {getLabel()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div className="flex flex-col gap-2 p-4">
          {/* Presets */}
          {presets?.length && (
            <div className="flex gap-2 mb-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl border-blue-900 text-blue-900"
                  onClick={() => handlePreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          {/* Calendar */}
         <Calendar
          mode="range"
          selected={tempRange ?? undefined} // ✅ Fix ici
          onSelect={(range) => {
            setTempRange(range ?? null);
            if (range?.from && range?.to) {
              onChange({ from: range.from, to: range.to });
              setOpen(false);
            }
          }}
          locale={fr}
          numberOfMonths={2}
          initialFocus
          className="rounded-xl"
        />

        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangePicker;
