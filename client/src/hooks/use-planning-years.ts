import { useQuery } from "@tanstack/react-query";

export interface PlanningYears {
  // Plan years available for NEW OKR/update submission (from the admin Years tab).
  submission: number[];
  // Plan years to show in VIEW filters: submission years plus any historical
  // plan year that still has data in the system.
  viewing: number[];
}

const EMPTY: PlanningYears = { submission: [], viewing: [] };

export function usePlanningYears(): PlanningYears {
  const { data } = useQuery<PlanningYears>({ queryKey: ["/api/planning-years"] });
  return data ?? EMPTY;
}
