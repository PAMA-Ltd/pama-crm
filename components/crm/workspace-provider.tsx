"use client";

import {
  createContext,
  useContext,
  useMemo,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import {
  listOrganizations,
  type CrmOrganization,
} from "@/lib/convex/organizations";
import WorkspaceOnboarding from "./workspace-onboarding";
import { useCompaniesStore } from "@/stores/companies-store";

type WorkspaceContextValue = {
  organization: CrmOrganization;
  organizations: CrmOrganization[];
  setOrganizationId: (organizationId: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const STORAGE_KEY = "pama-crm:organization";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const organizations = useQuery(listOrganizations, {});
  const storeWorkspaceId = useCompaniesStore((state) => state.workspaceId);
  const [preferredId, setPreferredId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const active = useMemo(() => {
    if (!organizations?.length) return null;
    return (
      organizations.find(
        (organization) =>
          organization._id === preferredId && organization.status === "active",
      ) ??
      organizations.find((organization) => organization.status === "active") ??
      organizations[0]
    );
  }, [organizations, preferredId]);

  useLayoutEffect(() => {
    if (active) useCompaniesStore.getState().switchWorkspace(active._id);
  }, [active?._id]);

  function setOrganizationId(organizationId: string) {
    useCompaniesStore.getState().switchWorkspace(organizationId);
    setPreferredId(organizationId);
    window.localStorage.setItem(STORAGE_KEY, organizationId);
  }

  if (organizations === undefined) {
    return (
      <main className="bg-background text-foreground flex h-dvh flex-1 items-center justify-center">
        <p className="caption-style text-subtle">Loading workspaces…</p>
      </main>
    );
  }

  if (!active) return <WorkspaceOnboarding />;
  if (storeWorkspaceId !== active._id) {
    return <main role="status" className="flex flex-1 items-center justify-center">Opening workspace…</main>;
  }

  return (
    <WorkspaceContext.Provider
      key={active._id}
      value={{ organization: active, organizations, setOrganizationId }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }
  return context;
}
