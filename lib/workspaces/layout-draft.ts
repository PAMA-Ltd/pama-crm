import type { WorkspaceModule, WorkspacePreset } from "./presets";

/**
 * Snapshot the version at the moment the administrator starts editing.
 * Never derive expectedVersion from a live query after the draft exists.
 */
export type WorkspaceLayoutDraft = {
  preset: WorkspacePreset;
  modules: WorkspaceModule[];
  baseVersion: number;
};

export type WorkspaceLayoutSnapshot = {
  preset: WorkspacePreset;
  enabledModules: readonly WorkspaceModule[];
  configVersion: number;
};

export function startLayoutDraft(
  currentDraft: WorkspaceLayoutDraft | null,
  live: WorkspaceLayoutSnapshot,
): WorkspaceLayoutDraft {
  return currentDraft ?? {
    preset: live.preset,
    modules: [...live.enabledModules],
    baseVersion: live.configVersion,
  };
}

export function isStaleLayoutDraft(
  draft: WorkspaceLayoutDraft | null,
  liveVersion: number,
): boolean {
  return draft !== null && draft.baseVersion !== liveVersion;
}

export function layoutDraftForSave(draft: WorkspaceLayoutDraft): {
  preset: WorkspacePreset;
  enabledModules: WorkspaceModule[];
  expectedVersion: number;
} {
  return {
    preset: draft.preset,
    enabledModules: [...draft.modules],
    expectedVersion: draft.baseVersion,
  };
}
