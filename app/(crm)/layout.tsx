import type { ReactNode } from "react";
import AuthGate from "@/components/_common/auth-gate";
import Sidebar from "@/components/_common/sidebar/sidebar";
import { WorkspaceProvider } from "@/components/crm/workspace-provider";
import WorkspaceRouteGuard from "@/components/crm/workspace-route-guard";

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <WorkspaceProvider>
        <main className="flex h-dvh max-w-full overflow-hidden">
          <Sidebar />
          <WorkspaceRouteGuard>{children}</WorkspaceRouteGuard>
        </main>
      </WorkspaceProvider>
    </AuthGate>
  );
}
