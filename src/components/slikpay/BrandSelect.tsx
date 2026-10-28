import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function BrandSelect({ label, value, onChange, options, className }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label} className={cn("slik-select-trigger h-11 font-semibold", className)}><SelectValue /></SelectTrigger>
    <SelectContent position="popper" sideOffset={6}>
      {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}