import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
}

export function DatePicker({ value, onChange, placeholder = "Choisir une date" }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[200px] justify-start text-left gap-2 text-blue-900 border-blue-900 bg-white"
        >
          <CalendarIcon size={18} />
          {value ? format(value, "dd/MM/yyyy", { locale: fr }) : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => {
            onChange(date ?? null)
            setOpen(false)
          }}
          locale={fr}
          initialFocus
          className="rounded-xl"
        />
      </PopoverContent>
    </Popover>
  )
}

export default DatePicker
