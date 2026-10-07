"use client";

import { useQuery } from "convex/react";
import { listDeals } from "@/lib/convex/deals";
import { useWorkspace } from "@/components/crm/workspace-provider";

export function useDeals(pipelineId?: string) {
  const { organization } = useWorkspace();
  const deals = useQuery(listDeals, {
    organizationId: organization._id,
    pipelineId,
    limit: 500,
  });
  return { deals: deals ?? [], isLoading: deals === undefined };
}
