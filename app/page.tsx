import Sidebar from "@/components/_common/sidebar/sidebar";
import AuthGate from "@/components/_common/auth-gate";
import Companies from "@/components/companies/companies";

export default function Home() {
  return (
    <AuthGate>
      <main className="flex h-dvh max-w-full overflow-hidden">
        <Sidebar />
        <Companies />
      </main>
    </AuthGate>
  );
}
