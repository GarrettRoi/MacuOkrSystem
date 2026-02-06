import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectCheckboxesProps {
  options: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  testIdPrefix?: string;
  labelExtractor?: (option: string) => { short: string; full: string };
}

function defaultLabelExtractor(option: string): { short: string; full: string } {
  const colonIndex = option.indexOf(":");
  if (colonIndex !== -1) {
    return {
      short: option.substring(0, colonIndex).trim(),
      full: option,
    };
  }
  return { short: option, full: option };
}

export function MultiSelectCheckboxes({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  testIdPrefix = "multi-select",
  labelExtractor = defaultLabelExtractor,
}: MultiSelectCheckboxesProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleRemove = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s !== option));
  };

  return (
    <div className="space-y-2">
      <div
        data-testid={`${testIdPrefix}-trigger`}
        className={cn(
          "flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          isOpen && "ring-2 ring-ring ring-offset-2"
        )}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <div className="flex-1 flex flex-wrap gap-1 min-h-[20px]">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((item) => {
              const label = labelExtractor(item);
              return (
                <Badge
                  key={item}
                  variant="secondary"
                  className="text-xs gap-1"
                  data-testid={`${testIdPrefix}-badge-${label.short}`}
                >
                  {label.short}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={(e) => handleRemove(item, e)}
                    data-testid={`${testIdPrefix}-remove-${label.short}`}
                  />
                </Badge>
              );
            })
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
          {selected.length > 0 && (
            <div className="flex justify-end pb-1 mb-1 border-b">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="text-xs h-7"
                data-testid={`${testIdPrefix}-clear-all`}
              >
                Clear all
              </Button>
            </div>
          )}
          {options.map((option) => {
            const label = labelExtractor(option);
            const isSelected = selected.includes(option);
            return (
              <label
                key={option}
                className={cn(
                  "flex items-start gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors",
                  isSelected
                    ? "bg-primary/5"
                    : "hover-elevate"
                )}
                data-testid={`${testIdPrefix}-option-${label.short}`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(option)}
                  className="mt-0.5 shrink-0"
                  data-testid={`${testIdPrefix}-checkbox-${label.short}`}
                />
                <span className="text-sm leading-relaxed">{label.full}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
