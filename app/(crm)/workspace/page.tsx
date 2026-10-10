"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { getWorkspaceSettings } from "@/lib/convex/workspace-settings";
import { workspaceLanding } from "@/lib/workspaces/presets";

export default function WorkspaceEntry() {
  const router = useRouter();
  const { organization } = useWorkspace();
  const settings = useQuery(getWorkspaceSettings, { organizationId: organization._id });

  useEffect(() => {
    if (settings) router.replace(workspaceLanding(settings.enabledModules));
  }, [router, settings]);

  return <main className="flex flex-1 items-center justify-center" role="status">
    Opening {organization.name} workspace…
  </main>;
}
