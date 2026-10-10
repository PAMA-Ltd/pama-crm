import { makeFunctionReference } from "convex/server";
import type { WorkspaceModule, WorkspacePreset } from "@/lib/workspaces/presets";

export type WorkspaceSettings = {
  preset: WorkspacePreset;
  enabledModules: WorkspaceModule[];
  configVersion: number;
  updatedAt: number;
  updatedBy: string;
};

export const getWorkspaceSettings = makeFunctionReference<
  "query",
  { organizationId: string },
  WorkspaceSettings
>("workspaceSettings:get");

export const updateWorkspaceSettings = makeFunctionReference<
  "mutation",
  { organizationId: string; preset: WorkspacePreset; enabledModules: WorkspaceModule[]; expectedVersion: number },
  WorkspaceSettings
>("workspaceSettings:update");
