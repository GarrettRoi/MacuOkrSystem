import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { StaffWithDetails } from "@shared/schema";

interface OnBehalfStaffPickerProps {
  staff: StaffWithDetails[];
  value: string | null;
  onChange: (staffId: string | null) => void;
  currentUserId: string;
  label?: string;
  description?: string;
}

export function OnBehalfStaffPicker({
  staff,
  value,
  onChange,
  currentUserId,
  label = "Submit on behalf of",
  description = "Choose a staff member to submit for. Leave empty to submit as yourself.",
}: OnBehalfStaffPickerProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () =>
      [...staff]
        .filter((s) => s.id !== currentUserId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, currentUserId],
  );

  const selected = value ? staff.find((s) => s.id === value) : undefined;

  return (
    <div className="bg-muted/50 p-4 rounded-md space-y-2 border" data-testid="section-on-behalf">
      <h3 className="font-medium text-sm text-muted-foreground">Acting on behalf of (Super Admin)</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="justify-between min-w-[16rem]"
              data-testid="button-on-behalf-select"
            >
              {selected ? selected.name : `${label}…`}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[20rem] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search staff…" data-testid="input-on-behalf-search" />
              <CommandList>
                <CommandEmpty>No staff found.</CommandEmpty>
                <CommandGroup>
                  {options.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.name} ${s.email}`}
                      onSelect={() => {
                        onChange(s.id === value ? null : s.id);
                        setOpen(false);
                      }}
                      data-testid={`option-on-behalf-${s.id}`}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === s.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.spu?.name}
                          {s.subUnit ? ` \u2014 ${s.subUnit.name}` : ""}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            data-testid="button-on-behalf-clear"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
