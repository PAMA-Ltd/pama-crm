"use client";

import { useQuery } from "convex/react";
import type { Company } from "@/data/companies";
import { daysSince } from "@/lib/companies";
import { listCompanies } from "@/lib/convex/companies";

export function useCompanies() {
  const rows = useQuery(listCompanies, { limit: 250 });

  const companies: Company[] =
    rows?.map(({ _id, _creationTime: _creationTime, ...company }) => ({
      id: _id,
      ...company,
      activityDays: daysSince(company.lastInteraction.date),
    })) ?? [];

  return {
    companies,
    isLoading: rows === undefined,
  };
}
