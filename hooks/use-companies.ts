"use client";

import { useQuery } from "convex/react";
import type { Company } from "@/data/companies";
import { daysSince } from "@/lib/companies";
import { listCompanies } from "@/lib/convex/companies";

export function useCompanies() {
  const rows = useQuery(listCompanies, { limit: 250 });

  const companies: Company[] =
    rows?.map((row) => ({
      id: row._id,
      name: row.name,
      tags: row.tags,
      owner: row.owner,
      openDeals: row.openDeals,
      pipelineValue: row.pipelineValue,
      winProbability: row.winProbability,
      trend: row.trend,
      lastInteraction: row.lastInteraction,
      activityDays: daysSince(row.lastInteraction.date),
      logo: row.logo,
    })) ?? [];

  return {
    companies,
    isLoading: rows === undefined,
  };
}
