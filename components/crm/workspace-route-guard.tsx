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
  const guarded = isSalesPage || pathname === "/events";
  const blocked = layout !== undefined && (
    (isSalesPage && !layout.enabledModules.includes("sales")) ||
    (pathname === "/events" && !layout.enabledModules.includes("lifecycle"))
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
