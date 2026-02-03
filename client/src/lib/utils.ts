import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Common name prefixes/titles to ignore when sorting alphabetically
const NAME_PREFIXES = ['dr.', 'dr', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'prof.', 'prof', 'rev.', 'rev'];

/**
 * Gets the sortable portion of a name by stripping common prefixes like "Dr.", "Mr.", etc.
 * This ensures "Dr. John Smith" sorts under "J" not "D"
 */
export function getSortableName(name: string): string {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  
  for (const prefix of NAME_PREFIXES) {
    if (lower.startsWith(prefix + ' ')) {
      return trimmed.substring(prefix.length + 1).trim();
    }
  }
  return trimmed;
}

/**
 * Compare function for sorting names alphabetically, ignoring common prefixes
 */
export function compareNames(a: string, b: string): number {
  return getSortableName(a).localeCompare(getSortableName(b));
}
