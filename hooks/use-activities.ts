"use client";

import { useQuery } from "convex/react";
import { listActivities } from "@/lib/convex/activities";

export function useActivities() {
  const activities = useQuery(listActivities, { limit: 500 });
  return {
    activities: activities ?? [],
    isLoading: activities === undefined,
  };
}
