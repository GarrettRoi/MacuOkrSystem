import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpuOption {
  id: string;
  name: string;
}

interface MultiSelectSpusProps {
  options: SpuOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  testIdPrefix?: string;
}

export function MultiSelectSpus({
  options,
  selectedIds,
  onChange,
  placeholder = "Select SPU(s)...",
  testIdPrefix = "multi-select-spu",
}: MultiSelectSpusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((s) => s !== id));
  };

  const handleOpen = () => {
    setIsOpen((v) => !v);
    if (isOpen) setSearch("");
  };

  const getNameById = (id: string) => options.find((o) => o.id === id)?.name ?? id;

  return (
    <div className="space-y-2">
      <div
        data-testid={`${testIdPrefix}-trigger`}
        className={cn(
          "flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          isOpen && "ring-2 ring-ring ring-offset-2"
        )}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        <div className="flex-1 flex flex-wrap gap-1 min-h-[20px]">
          {selectedIds.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedIds.map((id) => (
              <Badge
                key={id}
                variant="secondary"
                className="text-xs gap-1"
                data-testid={`${testIdPrefix}-badge-${id}`}
              >
                {getNameById(id)}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={(e) => handleRemove(id, e)}
                  data-testid={`${testIdPrefix}-remove-${id}`}
                />
              </Badge>
            ))
          )}
        </div>
        <div className="ml-2 shrink-0 text-muted-foreground">
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="rounded-md border border-input bg-background p-2 space-y-1 animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder="Search SPUs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="pl-8 h-8 text-sm"
              data-testid={`${testIdPrefix}-search`}
            />
          </div>
          {selectedIds.length > 0 && (
            <div className="flex justify-end pb-1 mb-1 border-b">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                className="text-xs h-7"
                data-testid={`${testIdPrefix}-clear-all`}
              >
                Clear all
              </Button>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No results found</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/5" : "hover-elevate"
                    )}
                    data-testid={`${testIdPrefix}-option-${option.id}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(option.id)}
                      className="shrink-0"
                      data-testid={`${testIdPrefix}-checkbox-${option.id}`}
                    />
                    <span className="text-sm">{option.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
