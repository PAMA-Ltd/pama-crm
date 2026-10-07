"use client";

import { useQuery } from "convex/react";
import { listActivities } from "@/lib/convex/activities";
import { useWorkspace } from "@/components/crm/workspace-provider";

export function useActivities() {
  const { organization } = useWorkspace();
  const activities = useQuery(listActivities, {
    organizationId: organization._id,
    limit: 500,
  });
  return { activities: activities ?? [], isLoading: activities === undefined };
}
