"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { getWorkspaceSettings } from "@/lib/convex/workspace-settings";
import { isSalesOnlyRoute } from "@/lib/workspaces/presets";

/**
 * Presentation route guard (NOT authorization): sales screens are only in the
 * current workspace's Sales layout. Convex enforces organization membership.
 */
export default function WorkspaceRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { organization } = useWorkspace();
  const layout = useQuery(getWorkspaceSettings, { organizationId: organization._id });
  const isSalesPage = isSalesOnlyRoute(pathname);
  const requiredModule = pathname === "/events" ? "lifecycle"
    : pathname === "/campaigns" ? "campaigns"
    : pathname === "/automations" ? "automations" : null;
  const isSegmentsPage = pathname === "/segments";
  const guarded = isSalesPage || Boolean(requiredModule) || isSegmentsPage;
  const blocked = layout !== undefined && (
    (isSalesPage && !layout.enabledModules.includes("sales")) ||
    (requiredModule !== null && !layout.enabledModules.includes(requiredModule)) ||
    (isSegmentsPage && !layout.enabledModules.includes("lifecycle") && !layout.enabledModules.includes("campaigns"))
  );

  useEffect(() => {
    if (blocked) router.replace("/workspace");
  }, [blocked, router]);

  if (guarded && (layout === undefined || blocked)) {
    return <main role="status" className="flex flex-1 items-center justify-center">
      {blocked ? "Opening your workspace…" : "Checking workspace layout…"}
    </main>;
  }

  return <>{children}</>;
}
