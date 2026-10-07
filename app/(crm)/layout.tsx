import type { ReactNode } from "react";
import AuthGate from "@/components/_common/auth-gate";
import Sidebar from "@/components/_common/sidebar/sidebar";

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <main className="flex h-dvh max-w-full overflow-hidden">
        <Sidebar />
        {children}
      </main>
    </AuthGate>
  );
}
