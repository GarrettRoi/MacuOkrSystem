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

const QUARTER_ORDER = ["Q1", "Q2", "Q3", "Q4"] as const;

export type QuarterPeriod = { quarter: string; year: number };

/**
 * Generate all quarter/year periods inclusive between start and end.
 */
export function generateQuarterPeriods(startQ: string, startY: number, endQ: string, endY: number): QuarterPeriod[] {
  const periods: QuarterPeriod[] = [];
  let curQ = startQ;
  let curY = startY;
  const endIdx = QUARTER_ORDER.indexOf(endQ as typeof QUARTER_ORDER[number]);
  while (curY < endY || (curY === endY && QUARTER_ORDER.indexOf(curQ as typeof QUARTER_ORDER[number]) <= endIdx)) {
    periods.push({ quarter: curQ, year: curY });
    const nextIdx = QUARTER_ORDER.indexOf(curQ as typeof QUARTER_ORDER[number]) + 1;
    if (nextIdx >= 4) { curQ = "Q1"; curY++; } else { curQ = QUARTER_ORDER[nextIdx]; }
    if (periods.length > 40) break; // safety cap
  }
  return periods;
}

export const CHART_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#65a30d", "#0d9488", "#ea580c",
];
