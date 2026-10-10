/**
 * Reversible workspace presentation defaults, never permanent organization types.
 * Only Sales UI is fully implemented as of the initial foundation.
 * Do not use this registry to authorize access to Convex records.
 */
export const WORKSPACE_PRESET_IDS = [
  "sales", "commerce", "saas", "services", "education", "custom",
] as const;
export type WorkspacePreset = (typeof WORKSPACE_PRESET_IDS)[number];

export const WORKSPACE_MODULE_IDS = [
  "sales", "lifecycle", "campaigns", "automations",
] as const;
export type WorkspaceModule = (typeof WORKSPACE_MODULE_IDS)[number];

export const WORKSPACE_MODULES: Record<WorkspaceModule, { label: string; ready: boolean; description: string }> = {
  sales: { label: "Sales", ready: true, description: "Companies, deals, pipelines and forecast" },
  lifecycle: { label: "Lifecycle", ready: true, description: "Customer event ingestion and event history" },
  campaigns: { label: "Campaigns", ready: true, description: "Audience segments and consent-aware email drafts" },
  automations: { label: "Automations", ready: true, description: "Event-triggered profile tagging and execution logs" },
};

export const WORKSPACE_PRESETS: Record<WorkspacePreset, {
  label: string;
  description: string;
  contactLabel: string;
  defaultModules: readonly WorkspaceModule[];
}> = {
  sales: {
    label: "Sales / B2B",
    description: "Sales pipeline, contacts, companies and forecasting",
    contactLabel: "Contacts",
    defaultModules: ["sales"],
  },
  commerce: {
    label: "Commerce",
    description: "Customer-first workspace, with optional sales tools",
    contactLabel: "Customers",
    defaultModules: ["lifecycle", "campaigns", "automations"],
  },
  saas: {
    label: "SaaS",
    description: "User relationships and lifecycle (advanced features upcoming)",
    contactLabel: "Users",
    defaultModules: ["lifecycle"],
  },
  services: {
    label: "Services",
    description: "Clients, proposals and sales opportunities",
    contactLabel: "Clients",
    defaultModules: ["sales"],
  },
  education: {
    label: "Education",
    description: "Student relationships (advanced features upcoming)",
    contactLabel: "Students",
    defaultModules: ["lifecycle"],
  },
  custom: {
    label: "Custom / General",
    description: "Core people and activities; add modules as needed",
    contactLabel: "People",
    defaultModules: [],
  },
};

export function modulesForPreset(preset: WorkspacePreset): WorkspaceModule[] {
  return [...WORKSPACE_PRESETS[preset].defaultModules];
}

export function defaultWorkspaceSettings() {
  return {
    preset: "sales" as WorkspacePreset,
    enabledModules: modulesForPreset("sales"),
    configVersion: 0,
    updatedAt: 0,
    updatedBy: "",
  };
}

/** Available landing routes, never a made-up dashboard or unsupported domain page. */
export function workspaceLanding(enabledModules: readonly WorkspaceModule[]): string {
  return enabledModules.includes("sales") ? "/companies" : "/contacts";
}

/** Sales-only screens have no meaning in non-Sales presentation layouts. */
export function isSalesOnlyRoute(pathname: string): boolean {
  return (
    ["/companies", "/deals", "/pipelines", "/forecast", "/sequences"].some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    ) ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/")
  );
}
