"use client";

import { useQuery } from "convex/react";
import { listDeals } from "@/lib/convex/deals";

export function useDeals() {
  const deals = useQuery(listDeals, { limit: 500 });
  return {
    deals: deals ?? [],
    isLoading: deals === undefined,
  };
}
